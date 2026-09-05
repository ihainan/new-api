#!/usr/bin/env python3
"""Batch provision New-API users and named API keys from DingTalk names.

This script intentionally contains no private URLs, tokens, or credentials.
Provide sensitive values through environment variables or a local env file
(.env.local and .env.provision.local are loaded by default; both are gitignored).
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import random
import secrets
import socket
import sqlite3
import stat
import string
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


DEFAULT_TOKEN_NAME = "agent-openclaw-auto"
DEFAULT_MODEL = "smart-router"
DEFAULT_BASE_URL = "http://127.0.0.1:52100"
DEFAULT_ENV_FILES = (".env.local", ".env.provision.local")
KEY_CHARS = string.digits + string.ascii_lowercase + string.ascii_uppercase


def force_ipv4() -> None:
    """Pin outbound connections to IPv4.

    DingTalk open APIs enforce a per-app IP allowlist. oapi.dingtalk.com answers
    with AAAA records first, so on a dual-stack host the request leaves over IPv6
    and is rejected with errcode 88 ("visiting ip is not in the allowlist") even
    though the host's IPv4 egress is allowlisted.
    """
    original_getaddrinfo = socket.getaddrinfo

    def getaddrinfo_ipv4(host, port, family=0, type=0, proto=0, flags=0):
        return original_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)

    socket.getaddrinfo = getaddrinfo_ipv4


class ProvisionError(Exception):
    pass


class EndpointNotFound(ProvisionError):
    pass


@dataclass
class PersonResult:
    name: str
    status: str = "pending"
    dingtalk_user_id: str = ""
    display_name: str = ""
    email: str = ""
    union_id: str = ""
    new_api_user_id: str = ""
    user_created: bool | None = None
    token_created: bool | None = None
    api_key: str = ""
    initial_token_present: bool | None = None
    initial_token_created: bool | None = None
    initial_api_key: str = ""
    models_ok: bool | None = None
    model_visible: bool | None = None
    chat_ok: bool | None = None
    chat_status: str = ""
    notes: list[str] = field(default_factory=list)


class JsonRpcClient:
    def __init__(self, url: str, timeout: int) -> None:
        self.url = url
        self.timeout = timeout
        self._next_id = 1

    def call(self, method: str, params: dict[str, Any] | None = None) -> Any:
        payload = {
            "jsonrpc": "2.0",
            "id": self._next_id,
            "method": method,
            "params": params or {},
        }
        self._next_id += 1
        data = http_request_json(
            self.url,
            method="POST",
            payload=payload,
            headers={"Accept": "application/json, text/event-stream"},
            timeout=self.timeout,
            parse_sse=True,
        )
        if isinstance(data, dict) and data.get("error"):
            raise ProvisionError(f"MCP {method} failed: {data['error']}")
        if isinstance(data, dict) and "result" in data:
            return data["result"]
        return data


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Batch create/reuse New-API users and named API keys for DingTalk users."
    )
    parser.add_argument("--names", help="File with one DingTalk display name per line.")
    parser.add_argument("--name", action="append", default=[], help="A single DingTalk display name. Repeatable.")
    parser.add_argument(
        "--user-id-override",
        action="append",
        default=[],
        metavar="NAME=USERID",
        help="Force a DingTalk userId for an ambiguous name. Repeatable.",
    )
    parser.add_argument(
        "--output",
        default=f"/tmp/new-api-agent-openclaw-keys-{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}.md",
        help="Markdown output path. Contains full API keys; default is under /tmp.",
    )
    parser.add_argument(
        "--env-file",
        action="append",
        default=[],
        help="Env file to load without overriding existing env. Repeatable. "
        f"Defaults to {', '.join(DEFAULT_ENV_FILES)}.",
    )
    parser.add_argument(
        "--mcp-url",
        default=os.environ.get("DINGTALK_MCP_URL", ""),
        help="DingTalk MCP streamable HTTP URL. Prefer DINGTALK_MCP_URL env.",
    )
    parser.add_argument(
        "--new-api-base-url",
        default=os.environ.get("NEW_API_BASE_URL", DEFAULT_BASE_URL),
        help=f"New-API base URL, default {DEFAULT_BASE_URL}.",
    )
    parser.add_argument(
        "--db-path",
        default=os.environ.get("NEW_API_DB_PATH", "data-local/one-api.db"),
        help="SQLite DB path used to read admin token and optional fallback writes.",
    )
    parser.add_argument(
        "--token-name",
        default=os.environ.get("TOKEN_NAME", DEFAULT_TOKEN_NAME),
        help=f"Named token to create/reuse, default {DEFAULT_TOKEN_NAME}.",
    )
    parser.add_argument("--model", default=os.environ.get("MODEL", DEFAULT_MODEL), help=f"Model to verify, default {DEFAULT_MODEL}.")
    parser.add_argument(
        "--chat-max-tokens",
        type=int,
        default=int(os.environ.get("CHAT_MAX_TOKENS", "512")),
        help="max_tokens used by --test-chat. smart-router may spend tokens on reasoning; default 512.",
    )
    parser.add_argument("--timeout", type=int, default=30, help="HTTP timeout in seconds.")
    parser.add_argument("--test-chat", action="store_true", help="Also call /v1/chat/completions for each key.")
    parser.add_argument(
        "--skip-initial-token",
        action="store_true",
        help="Do not ensure the standard '<username>的初始令牌' token after provisioning.",
    )
    parser.add_argument(
        "--allow-sqlite-fallback",
        action="store_true",
        help="If provision_api_key is 404, write user/token directly to SQLite.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Resolve DingTalk users but do not create users or keys.")
    parser.add_argument(
        "--allow-ipv6",
        action="store_true",
        help="Do not pin outbound connections to IPv4. The DingTalk IP allowlist "
        "normally covers only the IPv4 egress, so IPv4 is forced by default.",
    )
    return parser.parse_args()


def load_env_file(path: str) -> None:
    env_path = Path(path)
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key and key not in os.environ:
            os.environ[key] = value


def read_names(args: argparse.Namespace) -> list[str]:
    names: list[str] = []
    if args.names:
        for line in Path(args.names).read_text(encoding="utf-8").splitlines():
            clean = line.strip()
            if clean and not clean.startswith("#"):
                names.append(clean)
    names.extend(name.strip() for name in args.name if name.strip())
    seen: set[str] = set()
    unique_names: list[str] = []
    for name in names:
        if name not in seen:
            seen.add(name)
            unique_names.append(name)
    return unique_names


def read_user_id_overrides(args: argparse.Namespace) -> dict[str, str]:
    overrides: dict[str, str] = {}
    for raw in args.user_id_override:
        if "=" not in raw:
            raise ProvisionError(f"invalid --user-id-override {raw!r}; expected NAME=USERID")
        name, user_id = raw.split("=", 1)
        name = name.strip()
        user_id = user_id.strip()
        if not name or not user_id:
            raise ProvisionError(f"invalid --user-id-override {raw!r}; expected NAME=USERID")
        overrides[name] = user_id
    return overrides


def http_request_json(
    url: str,
    method: str = "GET",
    payload: Any | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 30,
    parse_sse: bool = False,
) -> Any:
    body = None
    request_headers = dict(headers or {})
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request_headers.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=body, headers=request_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            content_type = resp.headers.get("Content-Type", "")
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            raise EndpointNotFound(f"{method} {url} returned 404")
        err_body = exc.read().decode("utf-8", errors="replace")
        raise ProvisionError(f"{method} {url} failed with HTTP {exc.code}: {err_body[:500]}") from exc
    if parse_sse and ("text/event-stream" in content_type or raw.lstrip().startswith("event:") or raw.lstrip().startswith("data:")):
        return parse_sse_json(raw)
    if not raw.strip():
        return {}
    return json.loads(raw)


def parse_sse_json(raw: str) -> Any:
    data_chunks: list[str] = []
    for line in raw.splitlines():
        line = line.strip()
        if not line.startswith("data:"):
            continue
        data = line[5:].strip()
        if not data or data == "[DONE]":
            continue
        data_chunks.append(data)
    for chunk in reversed(data_chunks):
        try:
            return json.loads(chunk)
        except json.JSONDecodeError:
            continue
    raise ProvisionError("Could not parse JSON from SSE response")


def mcp_tool_call(client: JsonRpcClient, name: str, arguments: dict[str, Any]) -> Any:
    result = client.call("tools/call", {"name": name, "arguments": arguments})
    return unwrap_mcp_tool_result(result)


def unwrap_mcp_tool_result(result: Any) -> Any:
    if isinstance(result, dict):
        if "structuredContent" in result:
            return result["structuredContent"]
        if "content" in result and isinstance(result["content"], list):
            texts: list[str] = []
            for item in result["content"]:
                if isinstance(item, dict) and item.get("type") == "text":
                    texts.append(str(item.get("text", "")))
            joined = "\n".join(texts).strip()
            if joined:
                try:
                    return json.loads(joined)
                except json.JSONDecodeError:
                    return joined
    return result


def extract_values_by_key(obj: Any, target_keys: set[str]) -> list[Any]:
    found: list[Any] = []
    if isinstance(obj, dict):
        for key, value in obj.items():
            if key in target_keys:
                found.append(value)
            found.extend(extract_values_by_key(value, target_keys))
    elif isinstance(obj, list):
        for item in obj:
            found.extend(extract_values_by_key(item, target_keys))
    return found


def extract_user_ids(search_result: Any) -> list[str]:
    values = extract_values_by_key(search_result, {"userId", "userIds", "userid", "user_id", "user_id_list"})
    user_ids: list[str] = []
    for value in values:
        if isinstance(value, list):
            user_ids.extend(str(v) for v in value if str(v).strip())
        elif str(value).strip():
            user_ids.append(str(value))
    unique: list[str] = []
    seen: set[str] = set()
    for user_id in user_ids:
        if user_id not in seen:
            seen.add(user_id)
            unique.append(user_id)
    return unique


def find_org_employee(obj: Any) -> dict[str, Any]:
    if isinstance(obj, dict):
        if isinstance(obj.get("orgEmployeeModel"), dict):
            return obj["orgEmployeeModel"]
        if any(k in obj for k in ("orgUserName", "orgUserId", "jobNumber", "orgAuthEmail")):
            return obj
        for value in obj.values():
            found = find_org_employee(value)
            if found:
                return found
    elif isinstance(obj, list):
        for item in obj:
            found = find_org_employee(item)
            if found:
                return found
    return {}


def get_dingtalk_access_token(timeout: int) -> str:
    appkey = os.environ.get("DINGTALK_CLIENT_ID", "")
    appsecret = os.environ.get("DINGTALK_CLIENT_SECRET", "")
    if not appkey or not appsecret:
        raise ProvisionError("DINGTALK_CLIENT_ID and DINGTALK_CLIENT_SECRET are required")
    query = urllib.parse.urlencode({"appkey": appkey, "appsecret": appsecret})
    data = http_request_json(f"https://oapi.dingtalk.com/gettoken?{query}", timeout=timeout)
    if data.get("errcode") != 0:
        raise ProvisionError(f"DingTalk gettoken failed: {data}")
    token = data.get("access_token")
    if not token:
        raise ProvisionError("DingTalk gettoken returned empty access_token")
    return token


def dingtalk_user_to_union_id(user_id: str, corp_token: str, timeout: int) -> dict[str, Any]:
    url = "https://oapi.dingtalk.com/topapi/v2/user/get?access_token=" + urllib.parse.quote(corp_token)
    data = http_request_json(url, method="POST", payload={"userid": user_id, "language": "zh_CN"}, timeout=timeout)
    if data.get("errcode") != 0:
        raise ProvisionError(f"DingTalk user/get failed for {user_id}: {data}")
    result = data.get("result") or {}
    if not result.get("unionid"):
        raise ProvisionError(f"DingTalk user/get returned empty unionid for {user_id}")
    return result


def get_admin_auth(db_path: str) -> tuple[str, str]:
    env_user_id = os.environ.get("NEW_API_ADMIN_USER_ID", "")
    env_token = os.environ.get("NEW_API_ADMIN_ACCESS_TOKEN", "")
    if env_user_id and env_token:
        return env_user_id, env_token
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    try:
        row = con.execute(
            "select id, access_token from users "
            "where role >= 10 and access_token is not null and access_token <> '' "
            "order by role desc, id asc limit 1"
        ).fetchone()
    finally:
        con.close()
    if not row:
        raise ProvisionError("No admin access_token found; set NEW_API_ADMIN_USER_ID and NEW_API_ADMIN_ACCESS_TOKEN")
    return str(row["id"]), str(row["access_token"])


def provision_via_api(
    base_url: str,
    db_path: str,
    union_id: str,
    username: str,
    display_name: str,
    email: str,
    token_name: str,
    timeout: int,
) -> dict[str, Any]:
    admin_user_id, admin_access_token = get_admin_auth(db_path)
    payload = {
        "dingtalk_id": union_id,
        "username": username,
        "display_name": display_name,
        "email": email,
        "token_name": token_name,
    }
    data = http_request_json(
        base_url.rstrip("/") + "/api/user/provision_api_key",
        method="POST",
        payload=payload,
        headers={
            "Authorization": "Bearer " + admin_access_token,
            "New-Api-User": admin_user_id,
        },
        timeout=timeout,
    )
    if not isinstance(data, dict) or not data.get("success"):
        raise ProvisionError(f"provision_api_key failed: {data}")
    result = data.get("data") or {}
    token_key = str(result.get("token_key", ""))
    if not token_key:
        raise ProvisionError("provision_api_key returned empty token_key")
    return {
        "user_id": str(result.get("user_id", "")),
        "user_created": bool(result.get("user_created", False)),
        "token_created": bool(result.get("created", False)),
        "token_key": token_key,
        "source": "api",
    }


def table_columns(con: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in con.execute(f"pragma table_info({quote_ident(table)})").fetchall()}


def quote_ident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def sqlite_fallback_provision(
    db_path: str,
    union_id: str,
    username: str,
    display_name: str,
    email: str,
    token_name: str,
) -> dict[str, Any]:
    now = int(time.time())
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    try:
        con.execute("begin immediate")
        user_cols = table_columns(con, "users")
        token_cols = table_columns(con, "tokens")
        user = con.execute("select * from users where dingtalk_id = ? and deleted_at is null order by id desc limit 1", (union_id,)).fetchone()
        user_created = False
        safe_name = make_safe_username(con, username)
        if user is None:
            values = {
                "username": safe_name,
                "password": random_key(20),
                "display_name": truncate(display_name or username, 20),
                "role": 1,
                "status": 1,
                "email": email or "",
                "dingtalk_id": union_id,
                "quota": 0,
                "used_quota": 0,
                "request_count": 0,
                "group": "default",
                "aff_code": random_key(4),
                "aff_count": 0,
                "aff_quota": 0,
                "aff_history": 0,
                "inviter_id": 0,
                "setting": "{}",
            }
            insert_row(con, "users", user_cols, values)
            user = con.execute("select * from users where dingtalk_id = ? and deleted_at is null order by id desc limit 1", (union_id,)).fetchone()
            user_created = True
        if user is None:
            raise ProvisionError("SQLite fallback failed to create/find user")
        user_id = int(user["id"])

        token = con.execute(
            "select * from tokens where user_id = ? and name = ? and status = 1 "
            "and (expired_time = -1 or expired_time > ?) and deleted_at is null "
            "order by id desc limit 1",
            (user_id, token_name, now),
        ).fetchone()
        token_created = False
        if token is None:
            token_key = unique_token_key(con)
            values = {
                "user_id": user_id,
                "name": token_name,
                "key": token_key,
                "status": 1,
                "created_time": now,
                "accessed_time": now,
                "expired_time": -1,
                "remain_quota": 0,
                "unlimited_quota": 1,
                "model_limits_enabled": 0,
                "model_limits": "",
                "used_quota": 0,
                "group": "",
                "cross_group_retry": 0,
            }
            insert_row(con, "tokens", token_cols, values)
            token = con.execute(
                "select * from tokens where user_id = ? and name = ? and status = 1 "
                "and (expired_time = -1 or expired_time > ?) and deleted_at is null "
                "order by id desc limit 1",
                (user_id, token_name, now),
            ).fetchone()
            token_created = True
        if token is None:
            raise ProvisionError("SQLite fallback failed to create/find token")
        con.commit()
        return {
            "user_id": str(user_id),
            "user_created": user_created,
            "token_created": token_created,
            "token_key": str(token["key"]),
            "source": "sqlite",
        }
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def get_option(con: sqlite3.Connection, key: str, default: str = "") -> str:
    try:
        row = con.execute('select value from options where "key" = ? limit 1', (key,)).fetchone()
    except sqlite3.OperationalError:
        return default
    if not row or row[0] is None:
        return default
    return str(row[0])


def get_bool_option(con: sqlite3.Connection, key: str, default: bool = False) -> bool:
    raw = get_option(con, key, str(default).lower()).strip().lower()
    return raw in {"1", "true", "yes", "on"}


def get_int_option(con: sqlite3.Connection, key: str, default: int = 0) -> int:
    raw = get_option(con, key, str(default)).strip()
    try:
        return int(raw)
    except ValueError:
        return default


def get_user_username(db_path: str, user_id: int) -> str:
    con = sqlite3.connect(db_path)
    try:
        row = con.execute("select username from users where id = ? limit 1", (user_id,)).fetchone()
        if not row:
            raise ProvisionError(f"user {user_id} not found after provisioning")
        return str(row[0])
    finally:
        con.close()


def ensure_initial_token(db_path: str, user_id: int, username: str) -> dict[str, Any]:
    """Mirror model.CreateDefaultTokenForUser for provisioned users.

    The running New-API provision endpoint may create the requested named token
    without creating the standard initial token. This keeps batch-created users
    aligned with normal/OAuth registrations while leaving service code untouched.
    """
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    try:
        generate_default = get_bool_option(
            con,
            "GenerateDefaultToken",
            os.environ.get("GENERATE_DEFAULT_TOKEN", "").lower() == "true",
        )
        if not generate_default:
            return {"enabled": False, "present": False, "created": False, "token_key": ""}

        token_name = username + "的初始令牌"
        now = int(time.time())
        con.execute("begin immediate")
        token = con.execute(
            "select * from tokens where user_id = ? and name = ? and deleted_at is null "
            "and status = 1 and (expired_time = -1 or expired_time > ?) "
            "order by id desc limit 1",
            (user_id, token_name, now),
        ).fetchone()
        if token is not None:
            con.commit()
            return {"enabled": True, "present": True, "created": False, "token_key": str(token["key"])}

        token_cols = table_columns(con, "tokens")
        quota = get_int_option(con, "DefaultTokenQuota", 0)
        use_auto_group = get_bool_option(con, "DefaultUseAutoGroup", False)
        token_key = unique_token_key(con)
        values = {
            "user_id": user_id,
            "name": token_name,
            "key": token_key,
            "status": 1,
            "created_time": now,
            "accessed_time": now,
            "expired_time": -1,
            "remain_quota": 0 if quota == 0 else quota,
            "unlimited_quota": 1 if quota == 0 else 0,
            "model_limits_enabled": 0,
            "model_limits": "",
            "used_quota": 0,
            "group": "auto" if use_auto_group else "",
            "cross_group_retry": 0,
        }
        insert_row(con, "tokens", token_cols, values)
        con.commit()
        return {"enabled": True, "present": True, "created": True, "token_key": token_key}
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def insert_row(con: sqlite3.Connection, table: str, available_cols: set[str], values: dict[str, Any]) -> None:
    usable = {key: value for key, value in values.items() if key in available_cols}
    cols = list(usable.keys())
    sql = (
        f"insert into {quote_ident(table)} ("
        + ", ".join(quote_ident(col) for col in cols)
        + ") values ("
        + ", ".join("?" for _ in cols)
        + ")"
    )
    con.execute(sql, [usable[col] for col in cols])


def make_safe_username(con: sqlite3.Connection, candidate: str) -> str:
    base = truncate(candidate.strip() or "dingtalk_user", 20)
    exists = con.execute("select 1 from users where username = ? limit 1", (base,)).fetchone()
    if not exists:
        return base
    max_id = con.execute("select coalesce(max(id), 0) from users").fetchone()[0]
    return truncate(f"dingtalk_{max_id + 1}", 20)


def unique_token_key(con: sqlite3.Connection) -> str:
    for _ in range(20):
        key = random_key(48)
        exists = con.execute("select 1 from tokens where key = ? limit 1", (key,)).fetchone()
        if not exists:
            return key
    raise ProvisionError("Could not generate a unique token key")


def random_key(length: int) -> str:
    return "".join(secrets.choice(KEY_CHARS) for _ in range(length))


def truncate(value: str, max_len: int) -> str:
    return value[:max_len]


def normalize_api_key(token_key: str) -> str:
    return token_key if token_key.startswith("sk-") else "sk-" + token_key


def test_models(base_url: str, api_key: str, model: str, timeout: int) -> tuple[bool, bool, str]:
    try:
        data = http_request_json(
            base_url.rstrip("/") + "/v1/models",
            headers={"Authorization": "Bearer " + api_key},
            timeout=timeout,
        )
        model_ids = [str(item.get("id", "")) for item in data.get("data", []) if isinstance(item, dict)]
        return True, model in model_ids, ",".join(model_ids)
    except Exception as exc:
        return False, False, str(exc)


def test_chat(base_url: str, api_key: str, model: str, timeout: int, max_tokens: int) -> tuple[bool, str]:
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": "Please only reply pong."}],
        "stream": False,
        "max_tokens": max_tokens,
    }
    try:
        data = http_request_json(
            base_url.rstrip("/") + "/v1/chat/completions",
            method="POST",
            payload=payload,
            headers={"Authorization": "Bearer " + api_key},
            timeout=timeout,
        )
        if isinstance(data, dict) and data.get("error"):
            return False, json.dumps(data.get("error"), ensure_ascii=False)[:300]
        choice = ((data.get("choices") or [{}])[0] if isinstance(data, dict) else {})
        message = choice.get("message") or {}
        content = message.get("content")
        if content:
            return True, str(content)[:120]
        finish_reason = choice.get("finish_reason", "")
        reasoning = str(message.get("reasoning_content") or "")
        if reasoning:
            return False, f"no visible content; finish_reason={finish_reason}; reasoning={reasoning[:120]}"
        return False, "no visible content in chat response"
    except Exception as exc:
        return False, str(exc)[:300]


def process_person(
    name: str,
    mcp_client: JsonRpcClient,
    corp_token: str,
    args: argparse.Namespace,
    user_id_overrides: dict[str, str],
) -> PersonResult:
    result = PersonResult(name=name)
    try:
        if name in user_id_overrides:
            result.dingtalk_user_id = user_id_overrides[name]
            result.notes.append("used DingTalk userId override")
        else:
            search_result = mcp_tool_call(mcp_client, "search_user_by_key_word", {"keyWord": name})
            user_ids = extract_user_ids(search_result)
            if not user_ids:
                result.status = "failed"
                result.notes.append("DingTalk MCP returned no user")
                return result
            if len(user_ids) > 1:
                result.status = "needs-confirmation"
                result.notes.append("Multiple DingTalk users matched: " + ", ".join(user_ids))
                return result
            result.dingtalk_user_id = user_ids[0]

        detail_result = mcp_tool_call(mcp_client, "get_user_info_by_user_ids", {"user_id_list": [result.dingtalk_user_id]})
        employee = find_org_employee(detail_result)
        result.display_name = str(employee.get("orgUserName") or employee.get("name") or name)
        result.email = str(employee.get("orgAuthEmail") or employee.get("email") or "")

        ding_user = dingtalk_user_to_union_id(result.dingtalk_user_id, corp_token, args.timeout)
        result.union_id = str(ding_user.get("unionid", ""))
        result.email = result.email or str(ding_user.get("email") or "")
        result.display_name = str(ding_user.get("name") or result.display_name or name)

        if args.dry_run:
            result.status = "dry-run"
            result.notes.append("Resolved DingTalk user; no New-API writes performed")
            return result

        try:
            provision = provision_via_api(
                args.new_api_base_url,
                args.db_path,
                result.union_id,
                result.display_name or name,
                result.display_name or name,
                result.email,
                args.token_name,
                args.timeout,
            )
        except EndpointNotFound:
            if not args.allow_sqlite_fallback:
                raise
            provision = sqlite_fallback_provision(
                args.db_path,
                result.union_id,
                result.display_name or name,
                result.display_name or name,
                result.email,
                args.token_name,
            )
            result.notes.append("Used SQLite fallback because provision_api_key returned 404")

        result.new_api_user_id = provision["user_id"]
        result.user_created = bool(provision["user_created"])
        result.token_created = bool(provision["token_created"])
        result.api_key = normalize_api_key(str(provision["token_key"]))

        if not args.skip_initial_token:
            provisioned_username = get_user_username(args.db_path, int(result.new_api_user_id))
            initial = ensure_initial_token(args.db_path, int(result.new_api_user_id), provisioned_username)
            result.initial_token_present = bool(initial.get("present", False))
            result.initial_token_created = bool(initial.get("created", False))
            if initial.get("token_key"):
                result.initial_api_key = normalize_api_key(str(initial["token_key"]))
            if not initial.get("enabled", True):
                result.notes.append("initial token disabled by GenerateDefaultToken")

        result.models_ok, result.model_visible, model_note = test_models(args.new_api_base_url, result.api_key, args.model, args.timeout)
        if model_note and not result.model_visible:
            result.notes.append("models: " + model_note)

        if args.test_chat:
            result.chat_ok, result.chat_status = test_chat(
                args.new_api_base_url,
                result.api_key,
                args.model,
                args.timeout,
                args.chat_max_tokens,
            )
        result.status = "ok"
        return result
    except Exception as exc:
        result.status = "failed"
        result.notes.append(str(exc))
        return result


def markdown_bool(value: bool | None) -> str:
    if value is None:
        return "-"
    return "yes" if value else "no"


def escape_md(value: Any) -> str:
    text = "" if value is None else str(value)
    return text.replace("|", "\\|").replace("\n", "<br>")


def write_markdown(path: str, results: list[PersonResult], args: argparse.Namespace) -> None:
    output = Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# New-API batch API key provisioning result",
        "",
        f"- Created at: {dt.datetime.now().isoformat(timespec='seconds')}",
        f"- New-API base URL: `{args.new_api_base_url}`",
        f"- Token name: `{args.token_name}`",
        f"- Model checked: `{args.model}`",
        "",
        "> Sensitive: this file contains full API keys. Do not commit or share it.",
        "",
        "| Name | DingTalk userId | New-API user_id | User Created | Token Created | API Key | Initial Token | Initial API Key | Models OK | Model Visible | Chat | Status | Notes |",
        "|---|---:|---:|---|---|---|---|---|---|---|---|---|---|",
    ]
    for item in results:
        chat = markdown_bool(item.chat_ok)
        if item.chat_status:
            chat += f" ({item.chat_status})"
        lines.append(
            "| "
            + " | ".join(
                [
                    escape_md(item.name),
                    escape_md(item.dingtalk_user_id),
                    escape_md(item.new_api_user_id),
                    markdown_bool(item.user_created),
                    markdown_bool(item.token_created),
                    escape_md(item.api_key),
                    markdown_bool(item.initial_token_present) + (" (created)" if item.initial_token_created else ""),
                    escape_md(item.initial_api_key),
                    markdown_bool(item.models_ok),
                    markdown_bool(item.model_visible),
                    escape_md(chat),
                    escape_md(item.status),
                    escape_md("; ".join(item.notes)),
                ]
            )
            + " |"
        )
    output.write_text("\n".join(lines) + "\n", encoding="utf-8")
    output.chmod(stat.S_IRUSR | stat.S_IWUSR)


def main() -> int:
    args = parse_args()
    for env_file in args.env_file or DEFAULT_ENV_FILES:
        load_env_file(env_file)
    if not args.allow_ipv6:
        force_ipv4()
    if not args.mcp_url:
        args.mcp_url = os.environ.get("DINGTALK_MCP_URL", "")
    if not args.mcp_url:
        print("error: --mcp-url or DINGTALK_MCP_URL is required", file=sys.stderr)
        return 2
    names = read_names(args)
    if not names:
        print("error: provide --names or at least one --name", file=sys.stderr)
        return 2
    try:
        user_id_overrides = read_user_id_overrides(args)
    except ProvisionError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    mcp_client = JsonRpcClient(args.mcp_url, args.timeout)
    try:
        mcp_client.call(
            "initialize",
            {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "new-api-provisioner", "version": "1.0.0"},
            },
        )
    except Exception as exc:
        print(f"warning: MCP initialize failed, continuing anyway: {exc}", file=sys.stderr)

    corp_token = get_dingtalk_access_token(args.timeout)
    results = [process_person(name, mcp_client, corp_token, args, user_id_overrides) for name in names]
    write_markdown(args.output, results, args)

    ok_count = sum(1 for item in results if item.status in {"ok", "dry-run"})
    print(f"Wrote {args.output}")
    print(f"Processed {len(results)} names: {ok_count} ok/dry-run, {len(results) - ok_count} failed or need confirmation")
    return 0 if ok_count == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
