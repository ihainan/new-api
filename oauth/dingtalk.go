package oauth

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func init() {
	Register("dingtalk", &DingTalkProvider{})
}

// DingTalkProvider implements OAuth for DingTalk (钉钉).
//
// DingTalk deviates from standard OAuth 2.0 in the following ways:
//   - Token exchange uses JSON body (not form-encoded)
//   - UserInfo endpoint requires the custom header "x-acs-dingtalk-access-token" instead of "Authorization: Bearer"
//   - The callback may use "authCode" as the query parameter name instead of "code"
//
// Reference: https://open.dingtalk.com/document/development/obtain-identity-credentials
type DingTalkProvider struct{}

type dingTalkTokenRequest struct {
	ClientId     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
	Code         string `json:"code"`
	GrantType    string `json:"grantType"`
}

type dingTalkTokenResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpireIn     int    `json:"expireIn"`
	CorpId       string `json:"corpId"`
}

type dingTalkUserResponse struct {
	Nick      string `json:"nick"`
	AvatarUrl string `json:"avatarUrl"`
	Mobile    string `json:"mobile"`
	OpenId    string `json:"openId"`
	UnionId   string `json:"unionId"`
	Email     string `json:"email"`
}

func (p *DingTalkProvider) GetName() string {
	return "DingTalk"
}

func (p *DingTalkProvider) IsEnabled() bool {
	return common.DingTalkOAuthEnabled
}

func (p *DingTalkProvider) ExchangeToken(ctx context.Context, code string, c *gin.Context) (*OAuthToken, error) {
	// DingTalk may return the authorization code as "authCode" instead of "code".
	if code == "" {
		code = c.Query("authCode")
	}
	if code == "" {
		return nil, NewOAuthError(i18n.MsgOAuthInvalidCode, nil)
	}

	logger.LogDebug(ctx, "[OAuth-DingTalk] ExchangeToken: code=%s...", code[:min(len(code), 10)])

	reqBody := dingTalkTokenRequest{
		ClientId:     common.DingTalkClientId,
		ClientSecret: common.DingTalkClientSecret,
		Code:         code,
		GrantType:    "authorization_code",
	}
	jsonData, err := common.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.dingtalk.com/v1.0/oauth2/userAccessToken", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := http.Client{Timeout: 20 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-DingTalk] ExchangeToken error: %s", err.Error()))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthConnectFailed, map[string]any{"Provider": "DingTalk"}, err.Error())
	}
	defer res.Body.Close()

	logger.LogDebug(ctx, "[OAuth-DingTalk] ExchangeToken response status: %d", res.StatusCode)

	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(res.Body)
		bodyStr := string(body)
		if len(bodyStr) > 500 {
			bodyStr = bodyStr[:500] + "..."
		}
		logger.LogError(ctx, fmt.Sprintf("[OAuth-DingTalk] ExchangeToken failed: status=%d, body=%s", res.StatusCode, bodyStr))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthTokenFailed, map[string]any{"Provider": "DingTalk"}, fmt.Sprintf("status %d: %s", res.StatusCode, bodyStr))
	}

	var tokenRes dingTalkTokenResponse
	if err := common.DecodeJson(res.Body, &tokenRes); err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-DingTalk] ExchangeToken decode error: %s", err.Error()))
		return nil, err
	}

	if tokenRes.AccessToken == "" {
		logger.LogError(ctx, "[OAuth-DingTalk] ExchangeToken failed: empty access token")
		return nil, NewOAuthError(i18n.MsgOAuthTokenFailed, map[string]any{"Provider": "DingTalk"})
	}

	logger.LogDebug(ctx, "[OAuth-DingTalk] ExchangeToken success")

	return &OAuthToken{
		AccessToken: tokenRes.AccessToken,
		ExpiresIn:   tokenRes.ExpireIn,
	}, nil
}

func (p *DingTalkProvider) GetUserInfo(ctx context.Context, token *OAuthToken) (*OAuthUser, error) {
	logger.LogDebug(ctx, "[OAuth-DingTalk] GetUserInfo: fetching user info")

	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.dingtalk.com/v1.0/contact/users/me", nil)
	if err != nil {
		return nil, err
	}
	// DingTalk requires a proprietary header instead of "Authorization: Bearer".
	req.Header.Set("x-acs-dingtalk-access-token", token.AccessToken)
	req.Header.Set("Accept", "application/json")

	client := http.Client{Timeout: 20 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-DingTalk] GetUserInfo error: %s", err.Error()))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthConnectFailed, map[string]any{"Provider": "DingTalk"}, err.Error())
	}
	defer res.Body.Close()

	logger.LogDebug(ctx, "[OAuth-DingTalk] GetUserInfo response status: %d", res.StatusCode)

	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(res.Body)
		bodyStr := string(body)
		if len(bodyStr) > 500 {
			bodyStr = bodyStr[:500] + "..."
		}
		logger.LogError(ctx, fmt.Sprintf("[OAuth-DingTalk] GetUserInfo failed: status=%d, body=%s", res.StatusCode, bodyStr))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthGetUserErr, map[string]any{"Provider": "DingTalk"}, fmt.Sprintf("status %d", res.StatusCode))
	}

	var userRes dingTalkUserResponse
	if err := common.DecodeJson(res.Body, &userRes); err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-DingTalk] GetUserInfo decode error: %s", err.Error()))
		return nil, err
	}

	// unionId is used as the stable cross-app unique identifier.
	if userRes.UnionId == "" {
		logger.LogError(ctx, "[OAuth-DingTalk] GetUserInfo failed: empty unionId")
		return nil, NewOAuthError(i18n.MsgOAuthUserInfoEmpty, map[string]any{"Provider": "DingTalk"})
	}

	logger.LogDebug(ctx, "[OAuth-DingTalk] GetUserInfo success: unionId=%s, nick=%s, email=%s",
		userRes.UnionId, userRes.Nick, userRes.Email)

	return &OAuthUser{
		ProviderUserID: userRes.UnionId,
		Username:       userRes.Nick,
		DisplayName:    userRes.Nick,
		Email:          userRes.Email,
	}, nil
}

func (p *DingTalkProvider) IsUserIDTaken(providerUserID string) bool {
	return model.IsDingTalkIdAlreadyTaken(providerUserID)
}

func (p *DingTalkProvider) FillUserByProviderID(user *model.User, providerUserID string) error {
	user.DingTalkId = providerUserID
	return user.FillUserByDingTalkId()
}

func (p *DingTalkProvider) SetProviderUserID(user *model.User, providerUserID string) {
	user.DingTalkId = providerUserID
}

func (p *DingTalkProvider) GetProviderPrefix() string {
	return "dingtalk_"
}
