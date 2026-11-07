import type { Blueprint } from "../types";

/**
 * Sample Skill Shot, built to docs/skill-shots/skill.md (the FutureSkilz Skill Shot instructional design skill).
 * The case is an illustrative composite written for teaching. It is not from any expert's experience, and nothing in it is a claim
 * about a real company. Review status stays "draft" until a person has reviewed it.
 */
export const rootCauseSkillShot: Blueprint = {
  meta: {
    id: "root-cause-five-whys",
    title: "Find the cause, not just the symptom",
    version: "0.1.0",
    domain: "Problem solving",
    functionName: "Operations (applies to any function)",
    targetAudience: "New joiners and working professionals who fix problems that keep coming back",
    proficiency: "foundational",
    language: "English (India)",
    teachingPattern: "E",
    patternReason:
      "Concept, analogy and worked example fits a foundational method: a plain-language idea, an everyday analogy, a worked case, then a new problem for the learner to try.",
    prerequisites: ["Describe a problem with facts: who, what, where, when and how big (the 5W2H step in the Problem Solving kit)"],
    parentSkill: "Problem solving › Find the root cause",
    relatedSkillShots: ["assumption-test", "three-options"],
    contributorAttribution: "FutureSkilz Learning Design (illustrative case; not drawn from any expert's experience)",
    reviewStatus: "draft",
    skillMap: [{ skill: "problem-solving", toLevel: 2.5 }, { skill: "analytical-thinking", toLevel: 2.5 }, { skill: "critical-thinking", toLevel: 2 }],
  },
  design: {
    learningNeed: "A fix that does not last wastes time and trust. People often treat what they can see, so the problem returns.",
    learningObjective: "Trace a repeating problem, step by step, from what you can see to a cause you can fix, using five checkable whys.",
    successCriteria: [
      "Writes the problem as one factual sentence.",
      "Gives each answer as something that can be checked, and each answer explains the one before it.",
      "Stops at a cause in the process that the team can change, not at a person's name or a guess.",
      "Proposes one action aimed at that cause.",
    ],
    caseContext:
      "A small packing line has shipped orders for one customer a day late for three weeks. Reminding the packers to hurry worked for two days, then the orders were late again. (Illustrative: written for this lesson.)",
    keyConcept:
      "A symptom is what you notice. A root cause is the reason that, once removed, stops the problem from coming back. The five whys is the habit of asking why again and again, answering each time with something checkable.",
    methodOrFramework:
      "The five whys: state the problem in one factual sentence, ask why, answer with a checkable fact, check it, repeat until you reach a cause the process lets you change, then test whether removing it would stop the problem.",
    stepByStepApplication: [
      "Problem: orders for one customer ship a day late.",
      "Why 1: the order was not packed before the truck arrived, because the packers were waiting for labels.",
      "Why 2: the labels were late, because label printing starts only after the final quantity is confirmed in the system.",
      "Why 3: the quantity was confirmed late, because the last batch of the day is booked into stock the next morning.",
      "Why 4: the last batch is booked the next morning, because the stores clerk's shift ends before the last batch finishes.",
      "Why 5: nobody books it before they leave, because there is no end-of-shift handover step for the last batch.",
      "Root cause: the process has no handover step. Action: add a five-minute end-of-shift handover and book the last batch before the shift ends.",
    ],
    workedExample:
      "The packing line case, walked through five whys. The answer 'the packers were slow' is rejected at step one because it explains nothing that can be checked or changed; the label timestamps can be.",
    commonMistakes: [
      "Stopping at a person ('careless', 'forgot') instead of asking what in the process allowed it.",
      "Jumping to a solution before the cause is checked.",
      "Answering with opinions or guesses instead of facts that can be checked.",
      "Following only one chain when the problem has more than one cause.",
      "Treating 'five' as a rule: stop when you reach a cause you can fix, not when you have counted five.",
    ],
    limitationsAndCaveats: [
      "Works best on problems with a fairly direct chain of causes. Complex problems with several interacting causes need data and other tools alongside it.",
      "The answers are only as good as the evidence behind them: check each one before acting.",
      "It finds a cause you can act on, not necessarily the only cause.",
    ],
    learnerChallenge:
      "A different problem: delivery notes keep showing wrong quantities. The first answer is 'the picker counted wrong.' Choose the best next why.",
    workplaceTransferTask:
      "Pick one problem from the last month that came back after a fix. On one card, write the problem as a factual sentence and your chain of whys. Mark which answers you have checked. Propose one action aimed at the deepest cause, and share it with your team lead.",
    summaryTakeaways: [
      "Ask why until you reach a cause the process lets you change.",
      "Every answer must be a fact you can check, and must explain the one before it.",
      "Treat a person-level answer such as 'human error' as the start of the next question, not the end.",
    ],
    nextLearningRecommendation: [
      { label: "Try the 5 Whys tool on a real problem", href: "/problem-solving/five-whys", why: "Apply the method to a problem of your own, with checks." },
      { label: "Find which problem to solve first with a Pareto chart", href: "/problem-solving/pareto", why: "When there are many problems, the data shows which few matter most." },
      { label: "Show causes side by side with a fishbone", href: "/problem-solving/fishbone", why: "When one chain is not enough, a fishbone lays out several possible causes." },
    ],
  },
  disclosure:
    "Arya is an AI teacher and her voice is synthetic. This Skill Shot was designed by FutureSkilz Learning Design. The case is made up for teaching and is not any expert's experience. It is a draft and has not yet been reviewed by a person.",
  scenes: [
    {
      id: "hook",
      section: "hook",
      purpose: "Show a credible problem the learner recognises, and the question the lesson will answer.",
      title: "A fix that did not last",
      onScreen: ["Three weeks of late orders", "The talking-to worked for two days", "Why does the problem keep coming back?"],
      visual: {
        type: "case-card",
        heading: "The packing line",
        label: "Illustrative case, written for this lesson",
        facts: ["One customer's orders leave a day late", "Late for three weeks", "Fix tried: remind the packers to hurry", "Result: better for two days, then late again"],
      },
      narration:
        "Namaste. I am Arya, your AI teacher for this Skill Shot. Picture a small packing line. For three weeks, the orders for one customer have left a day late. The team has already tried the obvious fix: remind everyone to pack faster. It worked for two days, then the orders were late again. Here is the question for today: why does a problem you thought you had fixed keep coming back?",
      pauseSeconds: 3,
      cue: "greet",
      accessibility: "The case card lists four facts. The narration gives the same story in sentences. No information is carried by colour alone.",
      sources: ["S1"],
    },
    {
      id: "outcome",
      section: "outcome",
      purpose: "State what the learner will be able to do, tied to real work.",
      title: "By the end, you can…",
      onScreen: ["Trace a repeating problem to a cause you can fix", "Use five checkable whys"],
      narration:
        "By the end of this Skill Shot, you will be able to take a problem that keeps coming back and trace it, step by step, from what you can see to a cause you can actually fix. You will use a simple method called the five whys. It helps any time a fix does not last: late orders, repeat defects, missed handovers, rework.",
      pauseSeconds: 2,
      cue: "point",
      accessibility: "Two short lines on screen; the narration adds examples of where the method helps.",
      sources: ["S2"],
    },
    {
      id: "concept",
      section: "concept",
      purpose: "Explain the idea in plain language, with an analogy, then the accepted terms and their limits.",
      title: "Symptom and root cause",
      onScreen: ["Symptom: what you notice", "Root cause: what keeps producing it", "Ask why, again and again"],
      visual: {
        type: "compare",
        leftTitle: "Symptom",
        rightTitle: "Root cause",
        rows: [
          ["What it is", "What you notice", "What keeps producing it"],
          ["The question it answers", "What is going wrong?", "Why does it keep happening?"],
          ["A typical response", "Wipe, remind, rush", "Change the process"],
          ["Does the fix last?", "Usually not", "Yes, if the cause is right"],
        ],
      },
      narration:
        "Start with a leaking tap. You can keep wiping the floor, which treats the symptom. Or you can change the washer, which removes the cause. A symptom is what you notice. A root cause is the reason that, once you remove it, the problem stops coming back. The five whys is the habit of asking why did that happen, again and again, and answering each time with something you can check. Two rules matter. Each answer must be a fact you can check. And each answer must explain the one before it. The number five is a guide, not a law. Sometimes three whys are enough, sometimes you need seven.",
      pauseSeconds: 3,
      cue: "point",
      accessibility: "A two-column table compares symptom and root cause. The narration explains it with the leaking-tap analogy.",
      sources: ["S2"],
    },
    {
      id: "method",
      section: "method",
      purpose: "Show the steps, the decisions and the checks, and the common errors.",
      title: "The method, in five steps",
      onScreen: ["1  Write the problem as one factual sentence", "2  Ask why. Answer with a fact", "3  Check the answer", "4  Repeat until you reach a cause you can change", "5  Test: if we fix this, does the problem stop?"],
      visual: {
        type: "steps",
        items: ["Write the problem as one factual sentence", "Ask why. Answer with a fact", "Check the answer: look, count, ask the person doing the work", "Repeat until you reach a cause the process lets you change", "Test: if we remove this cause, does the problem stop?"],
      },
      narration:
        "Here is the method. First, write the problem as one factual sentence. Second, ask why, and answer with a fact. Third, check that answer: look at the records, count, or ask the person who does the work. Fourth, repeat until you reach a cause the process lets you change. Fifth, test it: if we removed this cause, would the problem stop? Watch for four common errors. Stopping at a person, like careless or forgot. Jumping to a solution too early. Answering with opinions. And following only one chain when there may be several. If an answer is we do not know, that is not the end. It tells you what to go and find out.",
      pauseSeconds: 3,
      cue: "point",
      accessibility: "Five numbered steps on screen. The narration adds the four common errors, which are also in the lesson notes.",
      sources: ["S2"],
    },
    {
      id: "application",
      section: "application",
      purpose: "Return to the opening case and apply the method step by step, with the reasoning and a caveat.",
      title: "The packing line, five whys",
      onScreen: ["Follow the chain from symptom to cause", "Each answer is a fact you could check"],
      visual: {
        type: "why-chain",
        problem: "Orders for one customer ship a day late",
        links: [
          { why: "Why was the order late?", because: "It was not packed before the truck came: the packers were waiting for labels." },
          { why: "Why were the labels late?", because: "Label printing starts only after the final quantity is confirmed in the system." },
          { why: "Why was the quantity confirmed late?", because: "The last batch of the day is booked into stock the next morning." },
          { why: "Why is it booked the next morning?", because: "The stores clerk's shift ends before the last batch finishes." },
          { why: "Why does nobody book it before leaving?", because: "There is no end-of-shift handover step for the last batch." },
        ],
        root: "Root cause: no handover step. Action: a five-minute end-of-shift handover; book the last batch before the shift ends.",
      },
      narration:
        "Now let us go back to the packing line. Why were the orders late? Because they were not packed before the truck came, as the packers were waiting for labels. Why were the labels late? Because label printing starts only after the final quantity is confirmed in the system. Why was the quantity confirmed late? Because the last batch of the day is booked into stock the next morning. Why the next morning? Because the stores clerk's shift ends before the last batch finishes. And why does nobody book it before leaving? Because there is no end-of-shift handover step. That is a cause the process lets us change. So the action is simple: add a five-minute handover, and book the last batch before the shift ends. Notice what we did not do. We did not blame the packers, or the clerk. We fixed the process. One caveat: in real work you would check each answer against the records before acting. In this story, I am telling you the checks passed, so treat it as an illustration.",
      pauseSeconds: 4,
      cue: "point",
      accessibility: "The chain is shown as five numbered question-and-answer pairs followed by the root cause, in reading order. All of it is also in the transcript.",
      sources: ["S1", "S2"],
    },
    {
      id: "challenge",
      section: "challenge",
      purpose: "Give the learner a new, related problem and ask for one decision, with a thinking pause and an explained answer.",
      title: "Your turn",
      onScreen: ["Delivery notes show wrong quantities", "First answer: the picker counted wrong", "What is the best next why?"],
      narration:
        "Your turn. A new problem: delivery notes keep showing the wrong quantities. The first answer on the board is: the picker counted wrong. What is the best next why? Take a few seconds to think, then choose.",
      pauseSeconds: 0,
      cue: "pause",
      interaction: {
        prompt: "Problem: delivery notes keep showing wrong quantities. Why 1: the picker counted wrong. What is the best next why?",
        context: "Illustrative case, written for this lesson.",
        thinkSeconds: 10,
        correctId: "b",
        options: [
          { id: "a", text: "Why was the picker careless?", feedback: "This points at the person and invites a guess about attitude. It is hard to check and will not change how the work is set up." },
          { id: "b", text: "Why was it easy to miscount, for example, was the pick list unclear or the stock layout confusing?", feedback: "Yes. It turns the person-level answer into a question about the process, and each part can be checked by looking at the pick list and the shelves." },
          { id: "c", text: "Why do we not hire more pickers?", feedback: "This jumps to a solution before the cause is found. More people may not stop miscounts." },
        ],
        rationale: "A good next why explains the previous answer with something you can check, and it points at the process, not at the person.",
      },
      accessibility: "Three options in plain text, selectable by keyboard. Feedback appears as text and is also spoken. Thinking time is shown on screen and can be skipped.",
      sources: ["S1", "S2"],
    },
    {
      id: "summary",
      section: "summary",
      purpose: "Reinforce the takeaways, give a workplace action and point to the next step.",
      title: "Take it to work",
      onScreen: ["Ask why until you reach a cause you can change", "Every answer must be checkable", "‘Human error’ starts the next question"],
      visual: {
        type: "takeaways",
        items: ["Ask why until you reach a cause the process lets you change.", "Every answer must be a fact you can check, and must explain the one before it.", "Treat a person-level answer, such as human error, as the start of the next question."],
      },
      narration:
        "Let us pull it together. Ask why until you reach a cause the process lets you change. Make every answer a fact you can check. And when the answer is a person, such as human error, treat it as the start of the next question, not the end. Here is your task at work. Pick one problem from the last month that came back after a fix. On one card, write the problem as a factual sentence and your chain of whys. Mark which answers you have checked. Then propose one action aimed at the deepest cause, and share it with your team lead. Next, you can try the five whys tool on a real problem of your own. Well done, and thank you for learning with me.",
      pauseSeconds: 2,
      cue: "greet",
      accessibility: "Three takeaways on screen. The workplace task is in the narration and in the lesson notes below the player.",
      sources: ["S2", "S3"],
    },
  ],
  knowledgeCheck: [
    {
      id: "q1",
      prompt: "A manager says, 'The root cause is that the packer was careless.' What is the best response?",
      correctId: "b",
      options: [
        { id: "a", text: "Agree, and coach the packer.", feedback: "Coaching may help, but 'careless' is a guess about a person, and it leaves the process unchanged." },
        { id: "b", text: "Ask what in the process made a careless moment possible or likely, and check it.", feedback: "Right. It turns a person-level answer into a question about the process that you can check." },
        { id: "c", text: "Stop, because five whys has been used.", feedback: "The number five is a guide. The test is whether you have reached a cause the process lets you change." },
      ],
      why: "A person-level answer is usually the start of the next why, not the end.",
    },
    {
      id: "q2",
      prompt: "Why were the labels late? Which answer is best?",
      correctId: "b",
      options: [
        { id: "a", text: "Because the labelling team is slow.", feedback: "That is an opinion about people, and it cannot easily be checked." },
        { id: "b", text: "Because label printing starts only after the final quantity is confirmed in the system, which the timestamps show.", feedback: "Yes. It is a fact that can be checked, and it explains the earlier answer." },
        { id: "c", text: "Because Mondays are busy.", feedback: "That is vague, and it does not explain why these orders were late." },
      ],
      why: "Each answer should be a checkable fact that explains the one before it.",
    },
    {
      id: "q3",
      prompt: "When is the five whys, on its own, not enough?",
      correctId: "c",
      options: [
        { id: "a", text: "Never. It always finds the one true cause.", feedback: "It finds a cause you can act on, not always the only one." },
        { id: "b", text: "Only when there are fewer than five answers.", feedback: "The number of answers is not the test." },
        { id: "c", text: "When several causes interact or the facts are not known. Then use data and other tools alongside it.", feedback: "Right. Check with data, and use tools such as a Pareto chart or a fishbone to look at more than one chain." },
      ],
      why: "It works best on fairly direct chains of causes; complex problems need evidence and other tools too.",
    },
  ],
  sources: [
    { id: "S1", kind: "illustrative", label: "Illustrative cases (the packing line and the delivery notes), written for this lesson by FutureSkilz Learning Design. Not from any expert's experience or any real company." },
    { id: "S2", kind: "method", label: "The five whys as a root-cause method, as taught in the FutureSkilz Problem Solving kit (5 Whys tool). Method steps, errors and limits follow common problem-solving practice and carry no figures or outcomes.", where: "/problem-solving/five-whys" },
    { id: "S3", kind: "design", label: "FutureSkilz Skill Shot instructional design skill, version 1.0.0 (structure, challenge and transfer task)." },
  ],
  learningPath: {
    skillSet: "Solve a problem that keeps coming back",
    capabilityModule: "Problem solving at work",
    rolePath: "New joiner readiness › Operations (and any function)",
    position: "After 'Describe a problem with facts'. Before 'Choose the problem to solve first' and 'Plan and test a fix'.",
  },
};
