const { StateGraph, START, END, Annotation } = require('@langchain/langgraph');
const { SecurityAgent } = require('../agents/security-agent');
const { QualityAgent } = require('../agents/quality-agent');
const { SynthesizerAgent } = require('../agents/synthesizer-agent');

const ReviewState = Annotation.Root({
  diff: Annotation({ reducer: (x, y) => y ?? x }),
  repo: Annotation({ reducer: (x, y) => y ?? x }),
  branch: Annotation({ reducer: (x, y) => y ?? x }),
  commit_sha: Annotation({ reducer: (x, y) => y ?? x }),
  security_issues: Annotation({ reducer: (x, y) => y ?? x, default: () => [] }),
  quality_issues: Annotation({ reducer: (x, y) => y ?? x, default: () => [] }),
  highlights: Annotation({ reducer: (x, y) => y ?? x, default: () => [] }),
  final_review: Annotation({ reducer: (x, y) => y ?? x }),
});

function createReviewGraph() {
  const securityAgent = new SecurityAgent();
  const qualityAgent = new QualityAgent();
  const synthesizerAgent = new SynthesizerAgent();

  const workflow = new StateGraph(ReviewState)
    .addNode('analyze', async (state) => {
      // Run specialized agents in parallel
      const [secResult, qualResult] = await Promise.all([
        securityAgent.run(state),
        qualityAgent.run(state)
      ]);
      
      return {
        security_issues: secResult.security_issues,
        quality_issues: qualResult.quality_issues,
        highlights: qualResult.highlights
      };
    })
    .addNode('synthesize', (state) => synthesizerAgent.run(state))
    .addEdge(START, 'analyze')
    .addEdge('analyze', 'synthesize')
    .addEdge('synthesize', END);

  return workflow.compile();
}

module.exports = { createReviewGraph };
