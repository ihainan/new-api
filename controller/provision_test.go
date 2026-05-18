package controller

import (
	"net/http"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

type provisionDataResponse struct {
	TokenKey    string `json:"token_key"`
	TokenName   string `json:"token_name"`
	UserID      int    `json:"user_id"`
	Created     bool   `json:"created"`
	UserCreated bool   `json:"user_created"`
}

func setupProvisionControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db := setupTokenControllerTestDB(t)
	if err := db.AutoMigrate(&model.User{}); err != nil {
		t.Fatalf("failed to migrate user table: %v", err)
	}
	return db
}

func decodeProvisionData(t *testing.T, recorderBody []byte) provisionDataResponse {
	t.Helper()

	response := tokenAPIResponse{}
	if err := common.Unmarshal(recorderBody, &response); err != nil {
		t.Fatalf("failed to decode api response: %v", err)
	}
	if !response.Success {
		t.Fatalf("expected success response, got message: %s", response.Message)
	}

	var data provisionDataResponse
	if err := common.Unmarshal(response.Data, &data); err != nil {
		t.Fatalf("failed to decode provision data: %v", err)
	}
	return data
}

func seedProvisionUser(t *testing.T, db *gorm.DB, dingTalkID string, username string) *model.User {
	t.Helper()

	user := &model.User{
		DingTalkId:  dingTalkID,
		Username:    username,
		DisplayName: username,
		Password:    common.GetRandomString(16),
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
	}
	if err := user.Insert(0); err != nil {
		t.Fatalf("failed to create user: %v", err)
	}
	return user
}

func TestProvisionUserAPIKeyCreatesUserAndNamedToken(t *testing.T) {
	db := setupProvisionControllerTestDB(t)
	body := map[string]any{
		"dingtalk_id":  "union-agent-openclaw",
		"username":     "Agent OpenClaw",
		"display_name": "Agent OpenClaw",
		"email":        "openclaw@example.com",
		"token_name":   "agent-openclaw-auto",
	}

	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/user/provision_api_key", body, 1)
	ProvisionUserAPIKey(ctx)

	data := decodeProvisionData(t, recorder.Body.Bytes())
	if data.TokenName != "agent-openclaw-auto" {
		t.Fatalf("expected token_name agent-openclaw-auto, got %q", data.TokenName)
	}
	if !data.Created || !data.UserCreated {
		t.Fatalf("expected token and user to be created, got created=%v user_created=%v", data.Created, data.UserCreated)
	}
	if data.TokenKey == "" || data.UserID == 0 {
		t.Fatalf("expected token_key and user_id in response: %+v", data)
	}

	var token model.Token
	if err := db.Where("user_id = ? AND name = ?", data.UserID, "agent-openclaw-auto").First(&token).Error; err != nil {
		t.Fatalf("expected named token to be stored: %v", err)
	}
	if token.GetFullKey() != data.TokenKey {
		t.Fatalf("expected stored token key %q, got %q", data.TokenKey, token.GetFullKey())
	}
}

func TestProvisionUserAPIKeyReturnsExistingNamedToken(t *testing.T) {
	db := setupProvisionControllerTestDB(t)
	user := seedProvisionUser(t, db, "union-agent-hermes", "hermes-user")
	existing := seedToken(t, db, user.Id, "agent-hermes-auto", "existing-hermes-token")

	body := map[string]any{
		"dingtalk_id": "union-agent-hermes",
		"username":    "ignored",
		"token_name":  "agent-hermes-auto",
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/user/provision_api_key", body, 1)
	ProvisionUserAPIKey(ctx)

	data := decodeProvisionData(t, recorder.Body.Bytes())
	if data.Created || data.UserCreated {
		t.Fatalf("expected existing token and user, got created=%v user_created=%v", data.Created, data.UserCreated)
	}
	if data.TokenKey != existing.GetFullKey() {
		t.Fatalf("expected existing token key %q, got %q", existing.GetFullKey(), data.TokenKey)
	}

	var count int64
	if err := db.Model(&model.Token{}).Where("user_id = ? AND name = ?", user.Id, "agent-hermes-auto").Count(&count).Error; err != nil {
		t.Fatalf("failed to count tokens: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one token, got %d", count)
	}
}

func TestProvisionUserAPIKeyRejectsInvalidTokenName(t *testing.T) {
	setupProvisionControllerTestDB(t)
	cases := []struct {
		name      string
		tokenName string
	}{
		{name: "missing", tokenName: ""},
		{name: "uppercase", tokenName: "Agent-OpenClaw-Auto"},
		{name: "space", tokenName: "agent openclaw auto"},
		{name: "too_long", tokenName: "agent-" + strings.Repeat("x", provisionTokenNameMaxLength)},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			body := map[string]any{
				"dingtalk_id": "union-invalid-" + tc.name,
				"username":    "invalid-" + tc.name,
			}
			if tc.tokenName != "" {
				body["token_name"] = tc.tokenName
			}
			ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/user/provision_api_key", body, 1)
			ProvisionUserAPIKey(ctx)

			response := decodeAPIResponse(t, recorder)
			if response.Success {
				t.Fatalf("expected token_name %q to be rejected", tc.tokenName)
			}
		})
	}
}

func TestProvisionUserTokenStillUsesLibreChatAuto(t *testing.T) {
	db := setupProvisionControllerTestDB(t)
	body := map[string]any{
		"dingtalk_id":  "union-librechat-compat",
		"username":     "LibreChat Compat",
		"display_name": "LibreChat Compat",
		"token_name":   "agent-openclaw-auto",
	}

	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/user/provision_token", body, 1)
	ProvisionUserToken(ctx)

	data := decodeProvisionData(t, recorder.Body.Bytes())
	var token model.Token
	if err := db.Where("user_id = ? AND name = ?", data.UserID, libreChatTokenName).First(&token).Error; err != nil {
		t.Fatalf("expected legacy librechat token to be stored: %v", err)
	}

	var agentTokenCount int64
	if err := db.Model(&model.Token{}).Where("user_id = ? AND name = ?", data.UserID, "agent-openclaw-auto").Count(&agentTokenCount).Error; err != nil {
		t.Fatalf("failed to count agent token: %v", err)
	}
	if agentTokenCount != 0 {
		t.Fatalf("legacy provision_token should ignore token_name override, got %d agent tokens", agentTokenCount)
	}
}

func TestValidateProvisionTokenNameAllowsExpectedAgentNames(t *testing.T) {
	for _, name := range []string{"agent-openclaw-auto", "agent-hermes-auto", "agent.v1_auto"} {
		if err := validateProvisionTokenName(name); err != nil {
			t.Fatalf("expected %q to be valid: %v", name, err)
		}
	}
	if err := validateProvisionTokenName("-bad"); err == nil {
		t.Fatalf("expected leading hyphen to be invalid")
	}
}
