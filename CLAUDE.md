## Revolutionary Approach: Direct Process Execution
### Overview
Instead of using tmux send-keys to interact with Codex CLI, use direct process execution with `codex exec` for cleaner, faster, and more reliable automation.
### Basic Usage
```bash
# Direct execution with custom settings
codex exec -s danger-full-access -c model_reasoning_effort="low" "Your task here"
# Examples
codex exec -s danger-full-access -c model_reasoning_effort="high" "Refactor the API to use TypeScript interfaces"
codex exec -s danger-full-access -c model_reasoning_effort="low" "List all files in src/"
```
### Helper Script Usage
A helper script `codex-exec.sh` simplifies common operations:
```bash
# Usage: ./codex-exec.sh [reasoning_level] "task"
./codex-exec.sh low "Quick file listing"
./codex-exec.sh high "Complex refactoring task"
./codex-exec.sh "Default task" # defaults to low reasoning
```
### Background Execution with Monitoring
For long-running tasks, use background execution:
```bash
# In Claude, use run_in_background parameter:
# Bash tool with run_in_background: true
# Then monitor with BashOutput tool using the returned bash_id
```
### Parallel Execution
Multiple Codex instances can run simultaneously:
```bash
# Start multiple background tasks
codex exec -s danger-full-access "Task 1" &
codex exec -s danger-full-access "Task 2" &
wait # Wait for all to complete
```
### Key Advantages Over TMux Approach
1. **No timing issues** - No sleep/wait commands needed
2. **Clean output** - Direct JSON/text without UI elements  
3. **Exit codes** - Proper error handling with return codes
4. **Parallel execution** - Run multiple instances simultaneously
5. **Scriptable** - Easy integration with CI/CD pipelines
### Reasoning Levels
- `minimal` - Fastest, limited reasoning (~5-10s for simple tasks)
- `low` - Balanced speed with some reasoning (~10-15s)
- `medium` - Default, solid reasoning (~15-25s)
- `high` - Maximum reasoning depth (~30-60s+)
### Safety Considerations
- Using `danger-full-access` grants full system access
- Auto-approval with `--ask-for-approval never` bypasses confirmations
- Consider permission models for production use
### Common Patterns
```bash
# Add new API endpoint
codex exec -s danger-full-access -c model_reasoning_effort="high" \
  "Add a new REST endpoint /api/users that returns user data"
# Refactor code
codex exec -s danger-full-access -c model_reasoning_effort="high" \
  "Refactor the authentication module to use JWT tokens"
# Generate tests
codex exec -s danger-full-access -c model_reasoning_effort="medium" \
  "Write unit tests for the user service module"
# Quick fixes
codex exec -s danger-full-access -c model_reasoning_effort="low" \
  "Fix the typo in README.md"
```
### Integration with Claude
When Claude needs to use Codex:
1. Use direct `codex exec` commands instead of tmux
2. For long tasks, use `run_in_background: true`
3. Monitor progress with `BashOutput` tool
4. Check exit codes for success/failure
5. Parse clean output without UI filtering
### Discovered Capabilities
- ✅ Non-interactive execution with `codex exec`
- ✅ Parallel task execution
- ✅ Background monitoring
- ✅ Custom reasoning levels
- ✅ Direct file modifications
- ✅ Automatic git patches
- ✅ TypeScript/JavaScript understanding
- ✅ API endpoint creation
- ✅ Code refactoring
codex-exec.sh
-------------
#!/bin/bash
# Codex Direct Execution Helper Script
# Usage: ./codex-exec.sh [reasoning_level] "Your task description"
# Examples:
#   ./codex-exec.sh low "List all files"
#   ./codex-exec.sh high "Refactor the API endpoints"
#   ./codex-exec.sh "Quick task" (defaults to low reasoning)
# Default reasoning level
REASONING="${1:-low}"
# If only one argument, it's the prompt with default reasoning
if [ $# -eq 1 ]; then
    PROMPT="$1"
    REASONING="low"
else
    PROMPT="$2"
fi
# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
echo -e "${BLUE}🤖 Codex Direct Execution${NC}"
echo -e "${YELLOW}Reasoning: ${REASONING}${NC}"
echo -e "${GREEN}Task: ${PROMPT}${NC}"
echo "----------------------------------------"
# Execute Codex with full access and no approval needed
codex exec \
    -s danger-full-access \
    -c model_reasoning_effort="${REASONING}" \
    "$PROMPT"
# Capture exit code
EXIT_CODE=$?
echo "----------------------------------------"
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Task completed successfully${NC}"
else
    echo -e "${RED}❌ Task failed with exit code: $EXIT_CODE${NC}"
fi
exit $EXIT_CODE