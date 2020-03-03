# Maurice

Algorithms and machinery to build automated trading systems.

## Getting Started

Copy `config.example.json` to `config.json`, update the secrets, and run `maurice` via `node maurce`.  This will log
into the configured brokerage account, watch for the symbols to grow more than $0.02, and report in Slack it's state.
 