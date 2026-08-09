export type CapabilityDetail = {
  definition: string;
  observableBehavior: string;
};

export const capabilityDetails: Record<string, CapabilityDetail> = {
  "analytical-thinking": {
    definition: "Break a complex question into parts, examine patterns and use evidence to reach a supported conclusion.",
    observableBehavior: "Separates facts from assumptions, compares relevant data and shows how the analysis supports the conclusion.",
  },
  "critical-thinking": {
    definition: "Evaluate the quality of claims, evidence and reasoning before accepting a conclusion or recommendation.",
    observableBehavior: "Tests assumptions, identifies missing evidence and explains what could prove the current view wrong.",
  },
  "creative-thinking": {
    definition: "Generate useful new possibilities by reframing a challenge and combining ideas beyond the first obvious answer.",
    observableBehavior: "Produces distinct options, explores unusual combinations and turns promising ideas into testable concepts.",
  },
  "strategic-thinking": {
    definition: "Make choices that connect long-term ambition, external change, competitive advantage and limited resources.",
    observableBehavior: "Clarifies where to play, how to win, what not to do and which assumptions determine strategic success.",
  },
  "systems-thinking": {
    definition: "Understand how connected actors, incentives, processes and feedback loops create outcomes over time.",
    observableBehavior: "Maps dependencies, anticipates second-order effects and avoids improving one part at the expense of the whole.",
  },
  "problem-solving": {
    definition: "Define the real problem, identify root causes, design options and implement a solution that addresses them.",
    observableBehavior: "Writes a clear problem statement, tests likely causes and tracks whether the chosen action changes the outcome.",
  },
  "decision-making": {
    definition: "Choose and commit to a course of action using objectives, evidence, trade-offs, risk and decision timing.",
    observableBehavior: "States decision criteria, compares credible options, records trade-offs and defines when the decision should be revisited.",
  },
  judgment: {
    definition: "Apply experience, values and context to make a sound call when rules or available evidence are incomplete.",
    observableBehavior: "Recognises ambiguity, seeks relevant perspectives and makes a proportionate choice with explicit safeguards.",
  },
  curiosity: {
    definition: "Seek a deeper and broader understanding by asking useful questions and exploring unfamiliar perspectives.",
    observableBehavior: "Asks open questions, follows surprising evidence and changes the inquiry when a better explanation emerges.",
  },
  "learning-agility": {
    definition: "Learn from experience quickly and transfer the lesson effectively into a new or unfamiliar situation.",
    observableBehavior: "Seeks feedback, extracts a reusable lesson, experiments with it and adjusts behaviour in the next situation.",
  },
  communication: {
    definition: "Exchange information and meaning clearly so the audience understands what matters and what happens next.",
    observableBehavior: "Adapts the message to the audience, checks understanding and makes the requested action unambiguous.",
  },
  "executive-communication": {
    definition: "Give senior decision-makers a concise, answer-first view of the issue, evidence, implications and required decision.",
    observableBehavior: "Leads with the conclusion, distinguishes signal from detail and handles challenge without losing the decision thread.",
  },
  collaboration: {
    definition: "Work across different roles and perspectives to produce a shared outcome that no participant could deliver alone.",
    observableBehavior: "Clarifies contributions, shares information early, resolves dependencies and gives credit across the group.",
  },
  leadership: {
    definition: "Create direction, commitment and conditions that enable people to deliver and grow through shared work.",
    observableBehavior: "Sets a clear outcome, aligns choices, removes obstacles and holds a team accountable without taking over its work.",
  },
  influence: {
    definition: "Shift understanding, commitment or action through relevance, credibility and relationships rather than formal authority alone.",
    observableBehavior: "Maps stakeholder interests, frames mutual value and adapts the case in response to legitimate concerns.",
  },
  negotiation: {
    definition: "Reach a workable agreement by understanding interests, creating options and trading value deliberately.",
    observableBehavior: "Prepares priorities and alternatives, asks about underlying interests and records clear reciprocal commitments.",
  },
  empathy: {
    definition: "Understand another person's experience and perspective accurately without assuming agreement or removing accountability.",
    observableBehavior: "Names the other perspective fairly, validates relevant concerns and adjusts the response without losing the objective.",
  },
  "active-listening": {
    definition: "Listen to understand meaning, emotion and intent before evaluating or preparing a response.",
    observableBehavior: "Uses open questions, paraphrases key points and checks interpretation before proposing an answer.",
  },
  "conflict-management": {
    definition: "Address disagreement constructively so underlying issues are resolved without damaging working relationships.",
    observableBehavior: "Separates people from the issue, surfaces interests, establishes facts and agrees a specific way forward.",
  },
  coaching: {
    definition: "Help another person improve their thinking and performance through questions, feedback, practice and ownership.",
    observableBehavior: "Clarifies the goal, asks rather than tells, gives specific feedback and agrees a learner-owned next experiment.",
  },
  "stakeholder-management": {
    definition: "Identify people affected by an outcome and manage their expectations, contribution and commitment over time.",
    observableBehavior: "Segments stakeholders by influence and interest, plans engagement and updates the approach as positions change.",
  },
  "self-awareness": {
    definition: "Recognise how personal patterns, strengths, emotions and impact shape decisions and relationships.",
    observableBehavior: "Names personal triggers and biases, compares intent with impact and chooses a deliberate adjustment.",
  },
  resilience: {
    definition: "Sustain or regain effective functioning after pressure, disappointment or disruption without ignoring real limits.",
    observableBehavior: "Regulates immediate reactions, restores priorities, seeks support when needed and converts setbacks into learning.",
  },
  adaptability: {
    definition: "Adjust thinking, behaviour and plans when circumstances change while protecting the outcome that still matters.",
    observableBehavior: "Recognises a changed assumption, updates priorities and communicates what changes, what remains and what comes next.",
  },
  "growth-mindset": {
    definition: "Treat capability as developable through effective effort, feedback, strategy and practice rather than fixed talent.",
    observableBehavior: "Chooses a stretch task, seeks actionable feedback and changes the learning method instead of defending current performance.",
  },
  motivation: {
    definition: "Direct and sustain effort by connecting work to meaningful goals, progress and appropriate sources of reward.",
    observableBehavior: "Translates intention into a specific commitment, monitors progress and redesigns conditions when energy falls.",
  },
  "emotional-regulation": {
    definition: "Notice and manage emotional responses so they inform action without controlling it.",
    observableBehavior: "Pauses under pressure, labels the emotion, chooses a proportionate response and returns to the intended outcome.",
  },
  "personal-effectiveness": {
    definition: "Convert priorities into reliable outcomes through focus, planning, energy management and follow-through.",
    observableBehavior: "Protects important work, sequences commitments, closes loops and renegotiates constraints before deadlines fail.",
  },
  "executive-presence": {
    definition: "Create credible, calm and purposeful impact in consequential situations through clarity, judgment and authentic conduct.",
    observableBehavior: "Frames the issue confidently, stays composed under challenge and communicates decisions with appropriate authority.",
  },
  "ai-literacy": {
    definition: "Understand what AI can and cannot do well enough to choose appropriate uses, controls and levels of human oversight.",
    observableBehavior: "Matches an AI approach to the task, explains key limitations and defines how outputs will be checked before use.",
  },
  "generative-ai": {
    definition: "Use models that create text, images, code or other content while managing quality, privacy and factual risk.",
    observableBehavior: "Provides useful context, iterates outputs, verifies claims and protects sensitive information throughout the workflow.",
  },
  prompting: {
    definition: "Give an AI system clear context, objective, constraints, evidence and output criteria to improve its response.",
    observableBehavior: "Writes structured instructions, tests ambiguous parts and refines the prompt based on observed output quality.",
  },
  "ai-collaboration": {
    definition: "Divide work deliberately between human judgment and AI assistance to improve speed, quality and learning.",
    observableBehavior: "Assigns suitable subtasks to AI, retains accountable decisions and uses feedback loops to improve the joint workflow.",
  },
  "ai-assisted-research": {
    definition: "Use AI to accelerate question formation, source discovery and synthesis without weakening source quality or traceability.",
    observableBehavior: "Builds a research plan, follows sources to originals, checks conflicting claims and records provenance for key findings.",
  },
  "ai-assisted-analysis": {
    definition: "Use AI to explore, structure and interpret information while independently checking methods, calculations and conclusions.",
    observableBehavior: "Defines the analytical question, validates inputs and logic, tests alternative explanations and documents human review.",
  },
  "ai-assisted-decision-making": {
    definition: "Use AI-generated insight as decision support while keeping objectives, trade-offs, ethics and accountability human-owned.",
    observableBehavior: "Requests alternatives and challenges, verifies material claims and records where human judgment changed or accepted the advice.",
  },
  "agentic-ai": {
    definition: "Design and supervise AI systems that plan and execute multi-step work using tools within defined authority and controls.",
    observableBehavior: "Sets goals, permissions, checkpoints and stop conditions, then monitors traces and intervenes when execution departs from policy.",
  },
  "ai-ethics": {
    definition: "Evaluate whether an AI use respects fairness, autonomy, privacy, transparency, safety and human dignity.",
    observableBehavior: "Identifies affected groups, tests foreseeable harm and changes or rejects a use when safeguards are insufficient.",
  },
  "ai-governance": {
    definition: "Establish roles, policies, controls and evidence that keep AI use lawful, accountable and aligned with organisational risk.",
    observableBehavior: "Classifies use cases by risk, assigns accountable owners and maintains approvals, monitoring, incidents and review records.",
  },
  "data-literacy": {
    definition: "Read, question, interpret and communicate data accurately enough to support sound decisions.",
    observableBehavior: "Checks definitions and sources, chooses an appropriate comparison and explains uncertainty without overstating the finding.",
  },
  "digital-literacy": {
    definition: "Use common digital tools confidently, safely and efficiently to communicate, create and complete work.",
    observableBehavior: "Selects suitable tools, organises digital work, protects information and learns unfamiliar features independently.",
  },
  "technology-literacy": {
    definition: "Understand how technology components and constraints shape feasibility, risk, cost and business value.",
    observableBehavior: "Explains the main system components, asks informed trade-off questions and translates technical limits into business implications.",
  },
  "cybersecurity-awareness": {
    definition: "Recognise common digital threats and consistently apply behaviours that protect systems, identities and information.",
    observableBehavior: "Uses secure access practices, handles data appropriately, detects suspicious activity and reports incidents promptly.",
  },
  automation: {
    definition: "Redesign repeatable work so technology executes suitable steps reliably with appropriate exception handling and oversight.",
    observableBehavior: "Maps the process, removes unnecessary steps, defines rules and exceptions, and monitors quality after automation.",
  },
  strategy: {
    definition: "Choose a coherent direction for creating value by aligning ambition, advantage, capabilities and resource allocation.",
    observableBehavior: "Makes explicit choices, links initiatives to advantage and reallocates resources away from work that does not support the strategy.",
  },
  finance: {
    definition: "Use financial concepts and evidence to understand performance, allocate resources and evaluate value and risk.",
    observableBehavior: "Interprets core statements, tests economic assumptions and connects operational choices to cash, return and exposure.",
  },
  marketing: {
    definition: "Understand chosen customers and create, communicate and capture value through differentiated market activity.",
    observableBehavior: "Defines a target segment, articulates its need and measures whether positioning and activation change customer behaviour.",
  },
  operations: {
    definition: "Design and run processes that convert resources into reliable customer value with appropriate quality, speed and cost.",
    observableBehavior: "Maps flow, identifies constraints, balances capacity and monitors service, quality, cost and continuous improvement.",
  },
  "product-management": {
    definition: "Guide a product toward valuable outcomes by integrating customer needs, business goals, evidence and delivery choices.",
    observableBehavior: "Frames the customer problem, prioritises outcomes, tests assumptions and adjusts the roadmap using product evidence.",
  },
  "project-management": {
    definition: "Coordinate scope, time, resources, risks and stakeholders to deliver a defined outcome responsibly.",
    observableBehavior: "Establishes ownership and milestones, manages dependencies and risks, and makes delivery status and decisions transparent.",
  },
};