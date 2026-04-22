package controller

import (
	"strconv"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const libreChatTokenName = "librechat-auto"

type ProvisionTokenRequest struct {
	DingTalkId  string `json:"dingtalk_id"`
	UserId      int    `json:"user_id"`
	// Optional fields used to auto-create the user when not found by dingtalk_id.
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Email       string `json:"email"`
}

// ProvisionUserToken is an admin-only endpoint used by LibreChat to obtain a personal
// API token for a new-api user identified by DingTalk unionId or user_id.
// When looked up by dingtalk_id and the user is not found, a new user is created using
// the optional username / display_name / email fields.
// Returns an existing "librechat-auto" token when valid, otherwise creates a new one.
func ProvisionUserToken(c *gin.Context) {
	var req ProvisionTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	var user model.User
	if req.DingTalkId != "" {
		user.DingTalkId = req.DingTalkId
		err := user.FillUserByDingTalkId()
		if err != nil {
			// User not found — auto-create if caller supplied enough info.
			if req.Username == "" {
				common.ApiErrorI18n(c, i18n.MsgUserNotExists)
				return
			}
			username := safeUsername(req.Username)
			newUser := model.User{
				DingTalkId:  req.DingTalkId,
				Username:    username,
				DisplayName: truncateRunes(req.DisplayName, model.UserNameMaxLength),
				Email:       req.Email,
				Password:    common.GetRandomString(16),
				Role:        common.RoleCommonUser,
				Status:      common.UserStatusEnabled,
			}
			if insertErr := newUser.Insert(0); insertErr != nil {
				common.ApiError(c, insertErr)
				return
			}
			// GORM populates the primary key on the struct after Create.
			user = newUser
		}
	} else if req.UserId != 0 {
		found, err := model.GetUserById(req.UserId, false)
		if err != nil {
			common.ApiErrorI18n(c, i18n.MsgUserNotExists)
			return
		}
		user = *found
	} else {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	existing, err := model.GetUserTokenByName(user.Id, libreChatTokenName)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if existing != nil && existing.Status == common.TokenStatusEnabled &&
		(existing.ExpiredTime == -1 || existing.ExpiredTime > common.GetTimestamp()) {
		common.ApiSuccess(c, gin.H{
			"token_key": existing.GetFullKey(),
			"user_id":   user.Id,
			"created":   false,
		})
		return
	}

	key, err := common.GenerateKey()
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgTokenGenerateFailed)
		return
	}
	newToken := model.Token{
		UserId:         user.Id,
		Name:           libreChatTokenName,
		Key:            key,
		CreatedTime:    common.GetTimestamp(),
		AccessedTime:   common.GetTimestamp(),
		ExpiredTime:    -1,
		UnlimitedQuota: true,
		Status:         common.TokenStatusEnabled,
	}
	if err := newToken.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"token_key": newToken.GetFullKey(),
		"user_id":   user.Id,
		"created":   true,
	})
}

// safeUsername returns a username that fits within UserNameMaxLength and falls back to
// a dingtalk_<nextId> pattern if the candidate is too long or already taken.
func safeUsername(candidate string) string {
	truncated := truncateRunes(candidate, model.UserNameMaxLength)
	if exists, err := model.CheckUserExistOrDeleted(truncated, ""); err == nil && !exists {
		return truncated
	}
	return "dingtalk_" + strconv.Itoa(model.GetMaxUserId()+1)
}

func truncateRunes(s string, max int) string {
	if utf8.RuneCountInString(s) <= max {
		return s
	}
	runes := []rune(s)
	return string(runes[:max])
}
