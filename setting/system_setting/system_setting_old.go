package system_setting

import "os"

var ServerAddress = func() string {
	if v := os.Getenv("SERVER_ADDRESS"); v != "" {
		return v
	}
	return "http://localhost:3000"
}()
var WorkerUrl = ""
var WorkerValidKey = ""
var WorkerAllowHttpImageRequestEnabled = false

func EnableWorker() bool {
	return WorkerUrl != ""
}
