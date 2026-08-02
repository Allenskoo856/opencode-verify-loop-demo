package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

const evidenceVersion = "verify/v1"

type Gate struct {
	Name       string `json:"name"`
	Command    string `json:"command"`
	Status     string `json:"status"`
	ExitCode   int    `json:"exitCode"`
	DurationMS int64  `json:"durationMs"`
	OutputFile string `json:"outputFile,omitempty"`
}
type Evidence struct {
	SchemaVersion      string   `json:"schemaVersion"`
	RunID              string   `json:"runId"`
	Profile            string   `json:"profile"`
	Model              string   `json:"model,omitempty"`
	BaseSHA            string   `json:"baseSha"`
	StartedAt          string   `json:"startedAt"`
	FinishedAt         string   `json:"finishedAt"`
	Iteration          int      `json:"iteration"`
	Conclusion         string   `json:"conclusion"`
	Gates              []Gate   `json:"gates"`
	ProtectedPaths     []string `json:"protectedPaths,omitempty"`
	ProtectedViolation []string `json:"protectedViolation,omitempty"`
}

var secretPattern = regexp.MustCompile(`(?i)(authorization:\s*bearer\s+|password|passwd|secret|token|api[_-]?key|cookie)(\s*[=:]\s*|\s+)[^\s,;]+`)

func redact(s string) string {
	s = secretPattern.ReplaceAllString(s, `${1}${2}[REDACTED]`)
	return strings.ReplaceAll(s, "gho_", "gho_[REDACTED]")
}
func root() string {
	if v := os.Getenv("VERIFY_WORKTREE"); v != "" {
		return v
	}
	cwd, _ := os.Getwd()
	return cwd
}
func run(ctx context.Context, dir, command string) (string, int, error) {
	c := exec.CommandContext(ctx, "sh", "-c", command)
	c.Dir = dir
	out, err := c.CombinedOutput()
	code := 0
	if err != nil {
		var e *exec.ExitError
		if errors.As(err, &e) {
			code = e.ExitCode()
		} else {
			code = 124
		}
	}
	return redact(string(out)), code, err
}
func writeOutput(dir, runID, name, output string) string {
	path := filepath.Join(dir, "artifacts", "verify", runID, name+".log")
	_ = os.MkdirAll(filepath.Dir(path), 0750)
	_ = os.WriteFile(path, []byte(output), 0600)
	return path
}
func git(dir string, args ...string) string {
	out, _ := exec.Command("git", append([]string{"-C", dir}, args...)...).Output()
	return strings.TrimSpace(string(out))
}
func shaFile(path string) string {
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()
	h := sha256.New()
	buf := make([]byte, 32*1024)
	for {
		n, e := f.Read(buf)
		if n > 0 {
			_, _ = h.Write(buf[:n])
		}
		if e != nil {
			break
		}
	}
	return hex.EncodeToString(h.Sum(nil))
}

func protectedChanges(dir, base string) []string {
	out := git(dir, "diff", "--name-only", base, "--")
	var bad []string
	for _, file := range strings.Split(out, "\n") {
		file = strings.TrimSpace(file)
		if file == "" {
			continue
		}
		if strings.HasPrefix(file, ".opencode/") || strings.HasPrefix(file, "docs/tasks/") || strings.HasPrefix(file, "e2e/specs/") || strings.HasPrefix(file, "verify/") || file == "verify-controller/policy.yaml" || file == "offline/SHA256SUMS" {
			bad = append(bad, file)
		}
	}
	status := git(dir, "status", "--porcelain")
	for _, line := range strings.Split(status, "\n") {
		if len(line) < 4 {
			continue
		}
		file := strings.TrimSpace(line[3:])
		if strings.HasPrefix(file, ".opencode/") || strings.HasPrefix(file, "docs/tasks/") || strings.HasPrefix(file, "e2e/specs/") || strings.HasPrefix(file, "verify/") || file == "verify-controller/policy.yaml" || file == "offline/SHA256SUMS" {
			bad = append(bad, file)
		}
	}
	return bad
}

func commands(profile string) [][2]string {
	fast := [][2]string{{"git-diff", "git diff --check"}, {"frontend-build", "npm --prefix frontend ci --ignore-scripts && npm --prefix frontend run build"}, {"controller-binary", "test -x verify-controller/bin/verify-loop && ./verify-controller/bin/verify-loop version >/dev/null"}}
	backend := [][2]string{{"backend-java8-test", "if command -v mvn >/dev/null 2>&1; then mvn -B -ntp -f backend/pom.xml test; else ./backend/mvnw test; fi"}}
	frontend := [][2]string{{"frontend-unit", "npm --prefix frontend ci --ignore-scripts && npm --prefix frontend run test:unit"}}
	switch profile {
	case "backend":
		return append(fast[:1], backend...)
	case "frontend":
		return append(fast[:1], frontend...)
	case "full", "staging":
		return append(append(append([][2]string{}, fast...), backend...), frontend...)
	default:
		return fast
	}
}

func verify(dir, profile, model, runID string, iteration int, base string) (Evidence, int) {
	started := time.Now()
	e := Evidence{SchemaVersion: evidenceVersion, RunID: runID, Profile: profile, Model: model, BaseSHA: base, StartedAt: started.UTC().Format(time.RFC3339), Iteration: iteration}
	e.ProtectedViolation = protectedChanges(dir, base)
	if len(e.ProtectedViolation) > 0 {
		fmt.Printf("protected paths changed: %s\n", strings.Join(e.ProtectedViolation, ", "))
		e.Conclusion = "BLOCKED_PROTECTED_PATH"
		e.FinishedAt = time.Now().UTC().Format(time.RFC3339)
		return e, 1
	}
	for _, item := range commands(profile) {
		g := Gate{Name: item[0], Command: item[1]}
		gateStart := time.Now()
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
		output, code, _ := run(ctx, dir, item[1])
		cancel()
		g.ExitCode = code
		g.DurationMS = time.Since(gateStart).Milliseconds()
		g.Status = "PASS"
		if code != 0 {
			g.Status = "FAIL"
		}
		g.OutputFile = writeOutput(dir, runID, item[0], output)
		e.Gates = append(e.Gates, g)
		fmt.Printf("gate=%s status=%s exit=%d duration_ms=%d\n", g.Name, g.Status, g.ExitCode, g.DurationMS)
		if code != 0 {
			e.Conclusion = "FAILED"
			break
		}
	}
	if e.Conclusion == "" {
		e.Conclusion = "PASS"
	}
	fmt.Printf("conclusion=%s\n", e.Conclusion)
	e.FinishedAt = time.Now().UTC().Format(time.RFC3339)
	return e, func() int {
		if e.Conclusion == "PASS" {
			return 0
		}
		return 1
	}()
}

func save(dir string, e Evidence) string {
	path := filepath.Join(dir, "artifacts", "verify", e.RunID, "evidence.json")
	_ = os.MkdirAll(filepath.Dir(path), 0750)
	data, _ := json.MarshalIndent(e, "", "  ")
	_ = os.WriteFile(path, append(data, '\n'), 0600)
	return path
}
func prompt(dir, model, session, text string, first bool) error {
	args := []string{"run", "--dir", dir, "--format", "json"}
	if model != "" {
		args = append(args, "--model", model)
	}
	if !first {
		args = append(args, "--continue")
	}
	args = append(args, text)
	c := exec.Command("opencode", args...)
	c.Stdout = os.Stdout
	c.Stderr = os.Stderr
	return c.Run()
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: verify-loop verify|run|status|doctor")
		os.Exit(2)
	}
	dir := root()
	base := git(dir, "rev-parse", "HEAD")
	runID := time.Now().UTC().Format("20060102T150405Z")
	switch os.Args[1] {
	case "version":
		fmt.Println("verify-loop 0.1.0")
		return
	case "doctor":
		fmt.Printf("worktree=%s\ngit=%s\nnode=%s\n", dir, base, git(dir, "--version"))
		if _, err := exec.LookPath("opencode"); err != nil {
			fmt.Println("opencode=missing (verify is available; run requires OpenCode)")
			return
		}
		fmt.Println("opencode=available")
		return
	case "status":
		path := filepath.Join(dir, "artifacts", "verify")
		entries, _ := os.ReadDir(path)
		if len(entries) == 0 {
			fmt.Println(`{"conclusion":"NO_RUN"}`)
			return
		}
		latest := entries[len(entries)-1].Name()
		data, err := os.ReadFile(filepath.Join(path, latest, "evidence.json"))
		if err != nil {
			os.Exit(2)
		}
		fmt.Print(string(data))
		return
	case "verify":
		fs := flag.NewFlagSet("verify", flag.ExitOnError)
		profile := fs.String("profile", "auto", "fast|backend|frontend|full|staging")
		model := fs.String("model", "", "model label")
		_ = fs.Parse(os.Args[2:])
		e, code := verify(dir, *profile, *model, runID, 1, base)
		fmt.Println(save(dir, e))
		os.Exit(code)
	case "run":
		fs := flag.NewFlagSet("run", flag.ExitOnError)
		taskFile := fs.String("task-file", "", "task file")
		profile := fs.String("profile", "auto", "verification profile")
		model := fs.String("model", "", "OpenCode model")
		max := fs.Int("max-iterations", 5, "maximum iterations")
		_ = fs.Parse(os.Args[2:])
		if *taskFile == "" {
			fmt.Fprintln(os.Stderr, "--task-file is required")
			os.Exit(2)
		}
		task, err := os.ReadFile(*taskFile)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(2)
		}
		first := true
		for i := 1; i <= *max; i++ {
			e, code := verify(dir, *profile, *model, runID, i, base)
			path := save(dir, e)
			fmt.Println(path)
			if code == 0 {
				return
			}
			feedback := fmt.Sprintf("外部 Verify Controller 第 %d 轮未通过。不要修改验收规则或测试以规避失败。请根据证据文件 %s 修复实现，然后等待下一轮验证。任务：\n%s", i, path, string(task))
			if err := prompt(dir, *model, "", feedback, first); err != nil {
				fmt.Fprintln(os.Stderr, "OpenCode continuation failed:", err)
				os.Exit(2)
			}
			first = false
		}
		os.Exit(1)
	default:
		fmt.Fprintln(os.Stderr, "unknown command:", os.Args[1])
		os.Exit(2)
	}
}
