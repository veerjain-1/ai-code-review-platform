const { pipeline, env } = require('@xenova/transformers');

// Optimize ONNX Runtime for Node.js environments
env.allowLocalModels = false; // Set to true if you download weights manually
env.useBrowserCache = false;

class LocalInferenceEngine {
  constructor() {
    this.generator = null;
    this.modelName = process.env.MODEL_NAME || 'Xenova/Qwen1.5-0.5B-Chat';
    this.initializing = null;
  }

  async init() {
    if (this.generator) return;
    if (this.initializing) {
      await this.initializing;
      return;
    }

    console.log(`\n⏳ Initializing local inference engine with model: ${this.modelName}`);
    console.log(`   (This may take a minute on the first run to download the ONNX weights)`);

    this.initializing = pipeline('text-generation', this.modelName, {
      progress_callback: (x) => {
        if (x.status === 'downloading' && x.name.endsWith('.onnx')) {
          process.stdout.write(`\r📥 Downloading ${x.file}: ${Math.round(x.progress)}%`);
        }
      }
    });

    this.generator = await this.initializing;
    console.log(`\n✅ Local model loaded successfully!`);
  }

  /**
   * Generate text based on a ChatML prompt structure
   * @param {Array<{role: string, content: string}>} messages
   */
  async generate(messages) {
    await this.init();

    // Format the messages for the Chat model (e.g. Qwen / TinyLlama)
    // Most @xenova/transformers chat models support apply_chat_template internally,
    // but if not, we can build the standard ChatML string manually.
    
    // We'll manually construct the ChatML template for reliability
    let prompt = '';
    for (const msg of messages) {
      prompt += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
    }
    prompt += `<|im_start|>assistant\n`;

    const result = await this.generator(prompt, {
      max_new_tokens: 512,
      temperature: 0.1,
      do_sample: true,
      return_full_text: false,
    });

    return result[0].generated_text.trim();
  }
}

// Export a singleton instance
const llm = new LocalInferenceEngine();

module.exports = { llm };
