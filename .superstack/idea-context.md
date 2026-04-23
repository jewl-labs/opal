# Idea Context

name: Opal
phase: idea
updated_at: 2026-04-23

idea_summary:
  Solana-native optimistic oracle for natural-language assertions, starting with prediction-market resolution.

validation:
  demand_signals:
    - Problem class has precedent: optimistic oracle mechanisms are used in production for prediction-style resolution (UMA pattern).
    - Solana hackathon ecosystem actively supports infra + prediction-adjacent builders, with visible sponsor/judge appetite for infra primitives.
    - Founder-provided signal: prediction markets on Solana need subjective resolution infrastructure for non-deterministic questions.
    - Team signal: 5-person build team and onboarding tokenomics expertise increases feasibility for multi-component delivery.
  risks:
    - category: demand
      description: Broad category demand is likely, but named design partners or signed pilot commitments are still not documented.
      severity: medium
    - category: execution
      description: Multi-integration scope remains complex; larger team reduces delivery risk if scope is staged.
      severity: medium
    - category: token-design
      description: PUSD and OPAL bootstrapping details are undefined for practical hackathon onboarding.
      severity: high
    - category: market
      description: Existing optimistic oracle/arbitration systems create a moderate competitive field.
      severity: medium
    - category: governance
      description: OPAL concentration and vote capture risks are not yet mitigated by concrete anti-whale mechanisms.
      severity: medium
    - category: infra
      description: Failure behavior for stale/unavailable Switchboard outcomes is underspecified.
      severity: medium
  go_no_go: go
  confidence: 0.79
  next_steps:
    - Narrow to hackathon MVP: assertion + first dispute + LLM resolution only.
    - Secure one design partner who will run a live integration in demo.
    - Publish explicit settlement SLAs and timeout/fallback rules.
    - Simplify token path for demo; postpone OPAL-heavy governance mechanics.
    - Prepare adversarial test cases across all four outcomes.
    - Deliver an integrator SDK and one-click demo flow for judges.

landscape:
  direct_competitors:
    - name: UMA Optimistic Oracle
      url: https://docs.uma.xyz/developers/optimistic-oracle-v3
      status: live
      strength: proven optimistic dispute flow and adoption in prediction contexts
      weakness: primarily EVM-focused ecosystem
    - name: Reality.eth
      url: https://reality.eth.limo/app/docs/html/
      status: live
      strength: mature crowd-sourced oracle and arbitration hooks
      weakness: not Solana-native default for most Frontier teams
  substitutes:
    - name: Kleros
      approach: decentralized juror arbitration
      why_users_stay: established arbitration framework and juror network
    - name: Centralized market moderators
      approach: trusted operator resolves outcomes offchain
      why_users_stay: lower complexity and faster initial launch
  dead_projects:
    - name: N/A in current pass
      why_failed: deeper post-hackathon archives needed to identify failed Solana-native subjective oracle attempts
  crowdedness: moderate
  moat_type: integrator UX + Solana-native finality + transparent dispute telemetry
  differentiation: Ship an integration-first subjective oracle SDK for Solana prediction apps with deterministic finalization windows.
