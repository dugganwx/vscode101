const curatedPapers = [
  {
    id: "attention-2017",
    title: "Attention Is All You Need",
    authors: "Vaswani et al.",
    year: 2017,
    groups: ["important"],
    preview:
      "Introduced the Transformer architecture, replacing recurrence with self-attention and enabling highly parallel training.",
    summary:
      "Introduced the Transformer architecture, replacing recurrence with self-attention. Enabled efficient parallelization during training compared with RNN-based models. Became the architectural base for modern LLMs and many multimodal systems.",
    datacenter:
      "Shifted workload characteristics toward dense matrix operations with high memory bandwidth demands. Established the scaling path that drove large GPU clusters and interconnect-heavy training infrastructure.",
    metrics:
      "Key result signal: superior translation quality with higher parallelism than recurrent baselines.",
    link: "https://arxiv.org/abs/1706.03762"
  },
  {
    id: "bert-2018",
    title: "BERT: Pre-training of Deep Bidirectional Transformers",
    authors: "Devlin et al.",
    year: 2018,
    groups: ["important", "read"],
    preview:
      "Validated bidirectional pretraining plus fine-tuning as a dominant paradigm and accelerated enterprise NLP adoption.",
    summary:
      "Demonstrated bidirectional pretraining and transfer learning gains in NLP tasks. Validated large-scale pretraining plus fine-tuning as a dominant paradigm. Accelerated enterprise NLP adoption and production inference at scale.",
    datacenter:
      "Sparked widespread inference deployment needs and cost-sensitive serving optimization. Increased focus on batching, quantization, and latency-throughput tradeoffs.",
    metrics:
      "Key result signal: state-of-the-art benchmark performance across several NLP tasks of its time.",
    link: "https://arxiv.org/abs/1810.04805"
  },
  {
    id: "gpt2-2019",
    title: "Language Models are Unsupervised Multitask Learners (GPT-2)",
    authors: "Radford et al.",
    year: 2019,
    groups: ["important"],
    preview:
      "Showed strong zero-shot behavior from generative pretraining and reinforced decoder-only scaling.",
    summary:
      "Showed strong zero-shot task performance from generative pretraining. Reinforced the value of decoder-only scaling for broad capability emergence. Influenced the architecture trajectory toward larger autoregressive models.",
    datacenter:
      "Increased demand for high-throughput autoregressive inference with strict latency constraints. Highlighted memory footprint and token generation efficiency as operational bottlenecks.",
    metrics:
      "Key result signal: broad zero-shot improvements that helped establish decoder-only scaling as a practical path.",
    link: "https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf"
  },
  {
    id: "gpt3-2020",
    title: "Language Models are Few-Shot Learners (GPT-3)",
    authors: "Brown et al.",
    year: 2020,
    groups: ["important", "read"],
    preview:
      "Demonstrated strong few-shot performance at 175B parameters and made prompt-based usage mainstream.",
    summary:
      "Demonstrated strong few-shot performance at 175B parameters. Cemented scaling laws in practical model development strategy. Made prompt-based usage mainstream across applications.",
    datacenter:
      "Exposed extreme training cost and cluster scheduling complexity. Elevated focus on model-parallel training, optimizer partitioning, and checkpoint strategy.",
    metrics:
      "Key result signal: strong few-shot and zero-shot performance across diverse NLP tasks at unprecedented scale.",
    link: "https://arxiv.org/abs/2005.14165"
  },
  {
    id: "scaling-laws-2020",
    title: "Scaling Laws for Neural Language Models",
    authors: "Kaplan et al.",
    year: 2020,
    groups: ["important"],
    preview:
      "Quantified power-law relationships between compute, model size, data, and loss for planning training programs.",
    summary:
      "Quantified power-law relationships between compute, model size, data, and loss. Provided planning heuristics for compute-efficient training programs. Influenced budget allocation and capacity forecasting in AI infrastructure.",
    datacenter:
      "Supports capex and opex planning for cluster build-outs. Informs tradeoffs among compute cycles, dataset expansion, and model parameter growth.",
    metrics:
      "Key result signal: predictable loss improvements under scale in model, data, and compute dimensions.",
    link: "https://arxiv.org/abs/2001.08361"
  },
  {
    id: "megatron-lm-2019",
    title: "Megatron-LM",
    authors: "Shoeybi et al.",
    year: 2019,
    groups: ["important", "read"],
    preview:
      "Introduced practical tensor and pipeline parallel methods for multi-billion parameter model training.",
    summary:
      "Introduced practical large-model parallelism strategies for training at scale. Demonstrated model and tensor parallel methods on large GPU clusters. Became foundational for modern distributed LLM training stacks.",
    datacenter:
      "Highlights communication overhead and network topology constraints. Directly relevant to NVLink, NVSwitch, and InfiniBand utilization and scaling efficiency.",
    metrics:
      "Key result signal: improved scaling efficiency for multi-billion parameter training on GPU clusters.",
    link: "https://arxiv.org/abs/1909.08053"
  },
  {
    id: "zero-2020",
    title: "ZeRO Memory Optimizations",
    authors: "Rajbhandari et al.",
    year: 2020,
    groups: ["important", "read"],
    preview:
      "Sharded optimizer state, gradients, and parameters to unlock much larger training jobs per cluster.",
    summary:
      "Proposed optimizer state, gradient, and parameter partitioning for memory reduction. Enabled much larger training jobs without linear memory duplication. Widely adopted through DeepSpeed and related distributed frameworks.",
    datacenter:
      "Improves hardware utilization and effective model capacity per cluster. Reduces memory bottlenecks and shifts performance focus to communication patterns.",
    metrics:
      "Key result signal: near-linear memory savings across distributed data-parallel workers.",
    link: "https://arxiv.org/abs/1910.02054"
  },
  {
    id: "gshard-2020",
    title: "GShard",
    authors: "Lepikhin et al.",
    year: 2020,
    groups: ["important"],
    preview:
      "Presented sparse MoE scaling with automatic sharding, increasing capacity while reducing per-token compute.",
    summary:
      "Presented sparse Mixture-of-Experts scaling with automatic sharding for very large parameter counts. Reduced per-token compute while increasing representational capacity. Established design patterns for expert routing at distributed scale.",
    datacenter:
      "Introduces network-sensitive all-to-all communication behavior. Makes interconnect design and congestion control key to achieving theoretical efficiency.",
    metrics:
      "Key result signal: large-scale sparse model growth with practical sharding automation.",
    link: "https://arxiv.org/abs/2006.16668"
  },
  {
    id: "switch-2021",
    title: "Switch Transformers",
    authors: "Fedus et al.",
    year: 2021,
    groups: ["important", "read"],
    preview:
      "Simplified top-1 MoE routing to improve training stability and sparse scalability.",
    summary:
      "Simplified MoE routing to improve training stability and scalability. Showed sparse architectures can reach trillion-parameter regime efficiently. Increased practical interest in sparse-dense hybrid infrastructure.",
    datacenter:
      "Emphasizes balancing expert load and minimizing communication hot spots. Drives requirements for high-bandwidth, low-latency fabric under irregular traffic.",
    metrics:
      "Key result signal: strong quality-compute efficiency tradeoffs compared with dense alternatives.",
    link: "https://arxiv.org/abs/2101.03961"
  },
  {
    id: "palm-2022",
    title: "PaLM",
    authors: "Chowdhery et al.",
    year: 2022,
    groups: ["important", "read"],
    preview:
      "Demonstrated strong quality from very large dense model training with robust data and system strategy.",
    summary:
      "Demonstrated strong performance from very large-scale dense language model training. Combined large compute budgets with robust data and architecture strategy. Influenced production-level foundation model training programs.",
    datacenter:
      "Highlights orchestration, checkpoint resilience, and long-run training reliability. Reinforces need for mature scheduling and fault-tolerant distributed execution.",
    metrics:
      "Key result signal: major benchmark gains through careful high-scale training design.",
    link: "https://arxiv.org/abs/2204.02311"
  },
  {
    id: "flashattention-2022",
    title: "FlashAttention",
    authors: "Dao et al.",
    year: 2022,
    groups: ["important", "read"],
    preview:
      "IO-aware exact attention algorithm that reduces HBM accesses and improves throughput.",
    summary:
      "Introduced IO-aware attention algorithm reducing HBM accesses. Achieved major speed and memory improvements without approximation. Became a key kernel-level optimization in training and inference stacks.",
    datacenter:
      "Shows software-kernel innovation can defer expensive hardware scaling. Improves throughput per accelerator and cluster-wide efficiency.",
    metrics:
      "Key result signal: significant training and inference speedups with lower memory overhead.",
    link: "https://arxiv.org/abs/2205.14135"
  },
  {
    id: "llama-2023",
    title: "LLaMA",
    authors: "Touvron et al.",
    year: 2023,
    groups: ["read"],
    preview:
      "Open foundation model family with favorable quality-to-size profile and broad ecosystem impact.",
    summary:
      "Released strong open model family with favorable performance-to-size profile. Enabled broader experimentation across academia and enterprise. Accelerated ecosystem tooling and fine-tuning practices.",
    datacenter:
      "Expanded demand for cost-efficient inference and fine-tuning infrastructure. Increased interest in mixed precision, quantization, and serving density optimization.",
    metrics:
      "Key result signal: competitive performance with relatively efficient model sizing.",
    link: "https://arxiv.org/abs/2302.13971"
  },
  {
    id: "vllm-2023",
    title: "PagedAttention (vLLM)",
    authors: "Kwon et al.",
    year: 2023,
    groups: ["important", "latest"],
    preview:
      "Proposed PagedAttention to improve KV cache utilization and serving throughput in real systems.",
    summary:
      "Proposed PagedAttention to improve KV cache utilization during serving. Significantly improved throughput and reduced memory fragmentation. Helped establish modern high-efficiency LLM serving design.",
    datacenter:
      "Direct impact on GPU memory utilization and tokens-per-second per dollar. Critical for multi-tenant serving economics in production environments.",
    metrics:
      "Key result signal: higher serving throughput and better memory utilization under real request patterns.",
    link: "https://arxiv.org/abs/2309.06180"
  },
  {
    id: "mistral-7b-2023",
    title: "Mistral 7B (and follow-on efficient open models)",
    authors: "Jiang et al.",
    year: 2023,
    groups: ["latest", "read"],
    preview:
      "Highlighted efficient architecture and training choices for strong small-model performance.",
    summary:
      "Highlighted efficient architecture and training choices for strong small-model performance. Popularized quality and cost optimization in open model development. Contributed to practical deployment choices beyond largest-parameter models.",
    datacenter:
      "Supports right-sizing strategy for workload classes. Improves fleet efficiency by matching model size to SLA and cost envelopes.",
    metrics:
      "Key result signal: strong quality-to-cost behavior for smaller open foundation models.",
    link: "https://arxiv.org/abs/2310.06825"
  },
  {
    id: "dbrx-2024",
    title: "DBRX Technical Report",
    authors: "Databricks",
    year: 2024,
    groups: ["latest"],
    preview:
      "Modern open MoE report focused on practical training, inference, and production deployment tradeoffs.",
    summary:
      "Describes a modern open MoE foundation model and production-oriented pipeline. Emphasizes practical system tradeoffs in training and inference for enterprise usage. Adds evidence for sparse model viability in real workloads.",
    datacenter:
      "Relevant to MoE serving architecture and cluster scheduling under mixed loads. Highlights memory bandwidth and network contention tradeoffs in sparse inference.",
    metrics:
      "Key result signal: strong open-model quality with a modern sparse architecture strategy.",
    link: "https://www.databricks.com/blog/introducing-dbrx-new-state-art-open-llm"
  }
];

let discoveredWebPapers = [
  {
    id: "web-deepseek-v3-technical-report",
    title: "DeepSeek-V3 Technical Report",
    authors: "DeepSeek (arXiv)",
    year: 2024,
    groups: ["latest", "read", "important"],
    preview:
      "Large MoE model report describing MLA plus DeepSeekMoE and cost-efficient training and inference design.",
    summary:
      "DeepSeek-V3 describes a large sparse model design with Mixture-of-Experts and Multi-head Latent Attention to improve efficiency at scale. The report details parameter activation strategy, training architecture, and systems decisions that impact throughput and cost.",
    datacenter:
      "Useful for operators evaluating sparse model economics, expert-routing communication pressure, and inference cost optimization in production clusters.",
    metrics:
      "Key result signal: high-capacity MoE model with a lower active-parameter footprint per token relative to full dense activation.",
    link: "https://arxiv.org/html/2412.19437v1",
    isDiscovery: true
  },
  {
    id: "web-deepseek-comprehensive-review-preprints",
    title: "A Comprehensive Review of DeepSeek: Performance, Architecture and Capabilities",
    authors: "Preprints.org",
    year: 2025,
    groups: ["latest", "read"],
    preview:
      "Survey-style review covering DeepSeek architecture, MoE design, and practical capability trends.",
    summary:
      "This review synthesizes published DeepSeek technical details and frames architecture choices such as MoE and latent attention in a broader LLM landscape context. It is useful as a consolidation source for engineers tracking model-system tradeoffs.",
    datacenter:
      "Helps infrastructure teams compare sparse and dense deployment implications, especially for memory planning and interconnect-aware scaling.",
    metrics:
      "Key result signal: comparative evidence suggesting DeepSeek-style sparse architectures can provide strong quality-efficiency balance.",
    link: "https://www.preprints.org/manuscript/202503.1887/v1",
    isDiscovery: true
  },
  {
    id: "web-deepseek-series-martinfowler",
    title: "The DeepSeek Series: A Technical Overview",
    authors: "Martin Fowler",
    year: 2025,
    groups: ["latest", "read"],
    preview:
      "Engineering-focused overview of the DeepSeek paper arc and architecture evolution.",
    summary:
      "This technical overview links multiple DeepSeek papers into a coherent timeline and highlights major architecture ideas. It is useful for quickly understanding how DeepSeek research themes connect across training, inference, and deployment concerns.",
    datacenter:
      "Provides a practical synthesis for platform teams deciding which DeepSeek techniques to prioritize for roadmap experiments.",
    metrics:
      "Key result signal: consolidates architecture shifts into actionable themes for engineering decision-making.",
    link: "https://martinfowler.com/articles/deepseek-papers.html",
    isDiscovery: true
  },
  {
    id: "web-deepseek-technical-tour-raschka",
    title: "A Technical Tour of the DeepSeek Models from V3 to V3.2",
    authors: "Sebastian Raschka",
    year: 2025,
    groups: ["latest", "read", "important"],
    preview:
      "Walkthrough of DeepSeek V3 era architecture decisions including MoE and MLA mechanisms.",
    summary:
      "This technical tour unpacks architecture choices in DeepSeek model generations and explains their practical implications. It is structured for engineers who need a concise but deep walkthrough of sparse routing and attention innovations.",
    datacenter:
      "Useful for understanding where compute and memory pressure move when adopting DeepSeek-style model internals.",
    metrics:
      "Key result signal: architecture-level explanation of efficiency gains tied to MoE activation and attention design.",
    link: "https://magazine.sebastianraschka.com/p/technical-deepseek",
    isDiscovery: true
  },
  {
    id: "web-deepseek-ibm-architecture",
    title: "DeepSeek's New Architecture and Why It Matters",
    authors: "IBM Think",
    year: 2025,
    groups: ["latest", "read"],
    preview:
      "Industry perspective on DeepSeek architecture implications for enterprise AI systems.",
    summary:
      "IBM's analysis discusses why DeepSeek architectural updates are strategically relevant and how they might influence enterprise adoption decisions. It is a useful bridge between research papers and operational planning.",
    datacenter:
      "Supports architecture strategy discussions around performance-per-dollar, deployment complexity, and model portfolio planning.",
    metrics:
      "Key result signal: enterprise-focused framing of architecture impact rather than benchmark-centric reporting.",
    link: "https://www.ibm.com/think/news/deepseek-mhc-new-architecture",
    isDiscovery: true
  },
  {
    id: "web-deepseek-r1-overview-gfg",
    title: "DeepSeek-R1: Technical Overview of Its Architecture and Innovations",
    authors: "GeeksforGeeks",
    year: 2025,
    groups: ["latest", "read"],
    preview:
      "Overview of DeepSeek-R1 concepts including MoE framing and architecture-level innovation summary.",
    summary:
      "This article gives a high-level technical overview of DeepSeek-R1 and its architecture ideas, with emphasis on efficiency and capability themes. It can serve as a quick orientation before reviewing deeper primary sources.",
    datacenter:
      "Useful for onboarding teams quickly to core DeepSeek architecture vocabulary before detailed implementation planning.",
    metrics:
      "Key result signal: accessible architecture summary focused on practical innovation themes.",
    link: "https://www.geeksforgeeks.org/artificial-intelligence/deepseek-r1-technical-overview-of-its-architecture-and-innovations/",
    isDiscovery: true
  },
  {
    id: "web-hadacore-2024",
    title: "HadaCore: Tensor Core Accelerated Hadamard Transform Kernel",
    authors: "HadaCore Authors",
    year: 2024,
    groups: ["latest", "read"],
    preview:
      "Fused GPU kernel that accelerates the Walsh-Hadamard Transform using Tensor Cores, directly enabling faster LLM quantization pipelines.",
    summary:
      "HadaCore implements the Walsh-Hadamard Transform (WHT) fused onto NVIDIA Tensor Core units, achieving throughput far above naive WHT implementations. The Hadamard transform is a critical building block in randomized-rotation quantization schemes such as QuIP# and QuaRot, which use it to reduce outliers before low-bit quantization of LLM weights and activations. By mapping WHT onto the same hardware path as GEMM, HadaCore removes the WHT step as a throughput bottleneck in quantization-aware inference pipelines.",
    datacenter:
      "Directly relevant to accelerator kernel efficiency: eliminates a non-GEMM bottleneck in FP4/INT4 quantization pipelines that target H100 and future Tensor Core generations. Reduces end-to-end quantization overhead and enables tighter integration of Hadamard-based rotation with weight-loading and dequantization passes.",
    metrics:
      "Key result signal: Tensor Core-fused WHT achieves significantly higher throughput than cuBLAS-based baselines, reducing the rotation step cost in quantization-aware LLM inference.",
    link: "AI papers for WebProject1/HadaCore Tensor Core Accelerated Hadamard Transform Kernel.pdf",
    isDiscovery: true,
    isLocal: true
  }
];

const localPaperFolder = "AI papers for WebProject1";
// localPaperFiles is seeded from papers-manifest.json at runtime.
// Add PDFs to the "AI papers for WebProject1" folder and run watch-papers.py
// to regenerate the manifest — the page will pick up new files automatically.
let localPaperFiles = [];
let dynamicLocalPapers = [];

// Sidecar metadata from papers-manifest.json: maps PDF filename → metadata object.
// Populated by pollManifestJson(); used by buildLocalPapers() to override defaults.
let _manifestMetadata = {};

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/^[0-9]+\./, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferYear(fileName) {
  const match = fileName.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : 2024;
}

function toDisplayTitle(fileName) {
  const base = fileName
    .replace(/\.pdf$/i, "")
    .replace(/^[0-9]+\./, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return base.length > 0 ? base : fileName;
}

function inferGroups(fileName, year) {
  const lower = fileName.toLowerCase();
  const groups = ["latest"];

  if (lower.includes("survey") || lower.includes("technical report") || lower.includes("benchmark")) {
    groups.push("read");
  }

  if (lower.includes("datacenter") || lower.includes("interconnect") || lower.includes("mi300")) {
    groups.push("important");
  }

  if (year <= 2021) {
    groups.push("important");
  }

  return [...new Set(groups)];
}

function buildLocalPapers(fileNames) {
  return fileNames.map((fileName) => {
    const sidecar = _manifestMetadata[fileName] || {};
    const year    = sidecar.year    || inferYear(fileName);
    const title   = sidecar.title   || toDisplayTitle(fileName);
    const groups  = inferGroups(fileName, year);
    const relativePath = `${localPaperFolder}/${fileName}`;

    return {
      id: `local-${slugify(fileName)}`,
      title,
      authors:    sidecar.authors    || "Repository Paper",
      year,
      groups,
      preview:    sidecar.preview    || "Local repository entry loaded from your WebProject1 paper folder.",
      summary:    sidecar.summary    || "This entry is pulled from the local paper repository. Add a custom hand-written summary here as you review the paper in detail.",
      datacenter: sidecar.datacenter || "Potentially relevant to accelerator efficiency, cluster architecture, inference economics, or system-level AI deployment tradeoffs.",
      metrics:    sidecar.metrics    || "Key result signal not yet extracted. Review and annotate this item for production use.",
      link:       sidecar.link       || encodeURI(relativePath),
      isLocal: true
    };
  });
}

// ── Hardware-engineer relevance scoring ───────────────────────────────────
// Scores each paper by keyword density (tiered) multiplied by a recency-decay
// factor. Used to derive groups ("important", "read", "latest") algorithmically.
const _hwKeywords = [
  // Tier 1 — Direct hardware design drivers (4 pts each)
  [/\bhbm\b|high.bandwidth.memory/i,                   4],
  [/\bnvlink\b|\bnvswitch\b|\binfinib\w+/i,             4],
  [/tensor.parall|pipeline.parall/i,                    4],
  [/flash.?attention/i,                                 4],
  [/paged.?attention|kv.cache/i,                        4],
  [/all.to.all|reduce.scatter/i,                        4],
  [/roofline|compute.bound|memory.bound/i,              4],
  [/\bgemm\b|matrix.multipl/i,                          4],
  [/\bfp8\b|\bfp4\b|bfloat16|\bnvfp\b/i,               4],
  // Tier 2 — System-level impact (2 pts each)
  [/mixture.of.expert|\bmoe\b|expert.rout/i,            2],
  [/memory.bandwidth/i,                                 2],
  [/quantiz/i,                                          2],
  [/model.parall|distributed.train/i,                   2],
  [/memory.optim|memory.partition/i,                    2],
  [/optimizer.state|gradient.*part/i,                   2],
  [/communication.overhead|communication.pattern/i,     2],
  [/throughput|tokens?.per.second/i,                    2],
  [/dataflow|interconnect/i,                            2],
  [/sharding|partitioning/i,                            2],
  [/checkpoint|fault.toleran/i,                         2],
  [/\bgpu.cluster\b|\baccelerator.cluster\b/i,          2],
  [/scaling.law/i,                                      2],
  [/capex|opex|cluster.build/i,                         2],
  [/compute.efficient|compute.budget/i,                 2],
  // Tier 3 — Architectural context (1 pt each)
  [/transformer\b/i,                                    1],
  [/sparse/i,                                           1],
  [/\bgpu\b|\btpu\b/i,                                  1],
  [/\bcluster\b/i,                                      1],
  [/\binference\b/i,                                    1],
  [/\bmemory\b/i,                                       1],
  [/large.language.model|llms?\b/i,                     1],
];

// Returns a relevance score for a paper relative to hardware engineers.
// Each keyword pattern contributes once (no double-counting per pattern).
// Score is then multiplied by a linear age-decay: −5%/yr, floor 50%.
function _hwScore(paper) {
  const corpus = [paper.title, paper.preview, paper.summary, paper.datacenter, paper.metrics]
    .filter(Boolean).join(" ");
  let raw = 0;
  for (const [re, pts] of _hwKeywords) {
    if (re.test(corpus)) raw += pts;
  }
  const age = new Date().getFullYear() - (paper.year || new Date().getFullYear());
  const decay = Math.max(0.50, 1 - age * 0.05);
  return Math.round(raw * decay * 10) / 10;
}

// Assign groups algorithmically for curated and pre-seeded discovery papers.
// Local papers keep their filename-inferred groups (inferGroups / buildLocalPapers).
// "important" is capped at the top-5 scorers across all static paper sets.
(function _applyHwGroups() {
  const currentYear = new Date().getFullYear();
  const allStaticPapers = [...curatedPapers, ...discoveredWebPapers];

  const scored = allStaticPapers
    .map((p) => ({ paper: p, score: _hwScore(p) }))
    .sort((a, b) => b.score - a.score);

  const importantIds = new Set(scored.slice(0, 5).map((s) => s.paper.id));

  for (const { paper, score } of scored) {
    const groups = [];
    if ((paper.year || 0) >= currentYear - 2) groups.push("latest");
    if (score >= 3)                           groups.push("read");
    if (importantIds.has(paper.id))           groups.push("important");
    if (groups.length === 0)                  groups.push("read"); // fallback
    paper.groups = groups;
  }
})();

// staticRepositoryPapers is rebuilt whenever the manifest is refreshed
let staticRepositoryPapers = [...curatedPapers];

let papers = [...discoveredWebPapers, ...staticRepositoryPapers];

const paperAltMap = {
  "attention-2017": "Transformer encoder-decoder architecture diagram with multi-head attention and feed-forward layers",
  "bert-2018": "BERT bidirectional token encoding with masked language model pre-training",
  "gpt2-2019": "GPT-2 decoder-only autoregressive language model architecture",
  "gpt3-2020": "GPT-3 parameter scale growth and few-shot in-context learning",
  "scaling-laws-2020": "Power-law scaling curves showing loss vs compute, model size, and data",
  "megatron-lm-2019": "Multi-GPU tensor and pipeline parallelism grid for large model training",
  "zero-2020": "ZeRO memory partitioning of optimizer states, gradients, and parameters across workers",
  "gshard-2020": "GShard sparse MoE token routing to expert subsets across devices",
  "switch-2021": "Switch Transformer simplified top-1 expert routing with load balancing",
  "palm-2022": "PaLM large-scale TPU pod cluster training infrastructure diagram",
  "flashattention-2022": "FlashAttention IO-aware tiled attention computation between HBM and SRAM",
  "llama-2023": "LLaMA open foundation model family sizes and efficiency characteristics",
  "vllm-2023": "vLLM PagedAttention KV cache block paging for high-throughput LLM serving",
  "mistral-7b-2023": "Mistral 7B grouped-query attention heads and sliding window attention mask",
  "dbrx-2024": "DBRX fine-grain MoE layer with 16 experts and top-4 sparse routing"
};

// ── Per-paper SVG diagram generator ───────────────────────────────────────
// Cache so all 15 SVGs are built only once, not on every card render.
let _diagramCache = null;

function _buildDiagramCache() {
  // viewBox height = 320 to ensure no text is clipped for any diagram.
  const mkSvg = (body) =>
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 320"><defs><marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#c66b2f"/></marker><marker id="ahl" markerWidth="8" markerHeight="6" refX="1" refY="3" orient="auto"><path d="M8,0 L0,3 L8,6 Z" fill="#c66b2f"/></marker></defs>${body}</svg>`
    )}`;

  const bg = `<rect width="640" height="320" fill="#eef2f8" rx="0"/>`;

  function label(x, y, txt, color = "#132028", size = 11) {
    return `<text x="${x}" y="${y}" text-anchor="middle" font-family="monospace" font-size="${size}" fill="${color}">${txt}</text>`;
  }
  // op = SVG opacity attribute (0–1), avoids 8-digit hex which is not valid SVG fill syntax.
  function box(x, y, w, h, fill, rx = 5, stroke = "none", sw = 1, op = 1) {
    const opAttr = op < 1 ? ` opacity="${op}"` : "";
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" rx="${rx}"${opAttr}/>`;
  }
  function lbl(x, y, txt, color = "white", size = 9) {
    return label(x, y, txt, color, size);
  }
  function layerBox(x, y, w, fill, txt) {
    return box(x, y, w, 24, fill, 4) + lbl(x + w / 2, y + 16, txt);
  }

  const diagrams = {

    // ── Transformer encoder-decoder diagram ──────────────────────────────
    "attention-2017": mkSvg(`
      ${bg}
      ${label(320, 18, "Transformer Architecture · Vaswani et al. 2017", "#132028", 12)}
      ${box(35, 28, 180, 240, "#dce8f5", 8, "#205ea6", 2)}
      ${label(125, 46, "ENCODER", "#205ea6", 11)}
      ${layerBox(50, 52, 150, "#205ea6", "Multi-Head Self-Attention")}
      ${layerBox(50, 82, 150, "#4c8ac0", "Add &amp; Normalize")}
      ${layerBox(50, 112, 150, "#205ea6", "Feed-Forward Network")}
      ${layerBox(50, 142, 150, "#4c8ac0", "Add &amp; Normalize")}
      ${label(125, 188, "× N layers", "#205ea6", 10)}
      ${layerBox(50, 196, 150, "#cde0f2", "Positional Encoding")}
      ${layerBox(50, 226, 150, "#b8d0ec", "Input Embeddings")}
      ${box(425, 28, 180, 240, "#f5dede", 8, "#9e2f2f", 2)}
      ${label(515, 46, "DECODER", "#9e2f2f", 11)}
      ${layerBox(440, 52, 150, "#9e2f2f", "Masked Multi-Head Attn")}
      ${layerBox(440, 82, 150, "#c26060", "Add &amp; Normalize")}
      ${layerBox(440, 112, 150, "#9e2f2f", "Cross-Attention")}
      ${layerBox(440, 142, 150, "#c26060", "Add &amp; Normalize")}
      ${layerBox(440, 172, 150, "#9e2f2f", "Feed-Forward + Norm")}
      ${label(515, 210, "× N layers", "#9e2f2f", 10)}
      ${layerBox(440, 218, 150, "#f0d0d0", "Output Embeddings")}
      <line x1="215" y1="124" x2="425" y2="124" stroke="#c66b2f" stroke-width="2" stroke-dasharray="5,3" marker-end="url(#ah)"/>
      ${label(320, 118, "cross-attn keys + values", "#c66b2f", 8)}
      ${box(455, 272, 120, 22, "#1f6b54", 4)}
      ${lbl(515, 287, "Linear · Softmax")}`),

    // ── BERT bidirectional masking diagram ───────────────────────────────
    "bert-2018": mkSvg(`
      ${bg}
      ${label(320, 18, "BERT — Bidirectional Encoder Representations · Devlin et al. 2018", "#132028", 11)}
      ${box(40, 30, 560, 50, "#dce8f5", 8, "#205ea6", 2)}
      ${label(320, 48, "Bidirectional Transformer Encoder (12–24 layers)", "#205ea6", 10)}
      ${label(320, 68, "← Self-attention flows in BOTH directions →", "#4c8ac0", 9)}
      ${["[CLS]", "The", "[MASK]", "sat", "on", "the", "[SEP]"].map((tok, i) => {
        const x = 45 + i * 79; const isMask = tok === "[MASK]";
        return box(x, 92, 70, 28, isMask ? "#c66b2f" : "#205ea6", 5) +
               lbl(x + 35, 111, tok, isMask ? "#fff" : "#e8f4ff", 10);
      }).join("")}
      <line x1="80" y1="88" x2="80" y2="70" stroke="#c66b2f" stroke-width="1.5" stroke-dasharray="3,2"/>
      <line x1="280" y1="88" x2="280" y2="70" stroke="#c66b2f" stroke-width="2.5"/>
      <line x1="560" y1="88" x2="560" y2="70" stroke="#c66b2f" stroke-width="1.5" stroke-dasharray="3,2"/>
      ${box(200, 135, 240, 30, "#f5dede", 6, "#9e2f2f", 1.5)}
      ${label(320, 155, "Pre-training: MLM + Next Sentence Prediction", "#9e2f2f", 9)}
      ${["NLP Classification", "Q&amp;A Span Extraction", "Named Entity Rec.", "Sentence Similarity"].map((task, i) => {
        const x = 45 + i * 148;
        return box(x, 180, 135, 26, "#1f6b54", 5) + lbl(x + 67, 197, task, "#e8f8f2", 8);
      }).join("")}
      ${label(320, 222, "Fine-tune on downstream tasks", "#1f6b54", 9)}
      ${box(180, 235, 280, 28, "#dce8f5", 6, "#205ea6", 1.5)}
      ${label(320, 254, "Transfer: one model → many NLP tasks", "#205ea6", 9)}
      ${label(320, 285, "State-of-the-art on GLUE, SQuAD, and 11 other benchmarks", "#132028", 9)}`),

    // ── GPT-2 autoregressive decoder diagram ─────────────────────────────
    "gpt2-2019": mkSvg(`
      ${bg}
      ${label(320, 18, "GPT-2 — Decoder-Only Autoregressive LM · Radford et al. 2019", "#132028", 11)}
      ${box(30, 28, 580, 55, "#f5e8d8", 8, "#c66b2f", 2)}
      ${label(320, 45, "Decoder-Only Transformer  (no encoder side)", "#c66b2f", 10)}
      ${label(320, 63, "Causal mask: each token attends only to past tokens →", "#c66b2f", 9)}
      ${["The", "cat", "sat", "on", "the", "mat", "and"].map((tok, i) => {
        const x = 35 + i * 80;
        return box(x, 95, 68, 28, "#205ea6", 5) + lbl(x + 34, 114, tok, "#e8f4ff", 10);
      }).join("")}
      ${[0,1,2,3,4,5].map(i => `<line x1="${103 + i*80}" y1="109" x2="${173 + i*80}" y2="109" stroke="#c66b2f" stroke-width="1.8" marker-end="url(#ah)"/>`).join("")}
      ${box(35, 138, 545, 28, "#dce8f5", 6, "#205ea6", 1.5)}
      ${label(308, 157, "Causal Self-Attention — attends left-to-right only", "#205ea6", 9)}
      ${box(35, 172, 545, 28, "#205ea6", 6)}
      ${label(308, 191, "Feed-Forward + LayerNorm  (×48 decoder layers at 1.5B)", "white", 9)}
      ${box(480, 215, 108, 28, "#c66b2f", 5)}
      ${lbl(534, 234, "→ next token", "#fff", 10)}
      <line x1="560" y1="123" x2="560" y2="215" stroke="#c66b2f" stroke-width="1.5" stroke-dasharray="4,2" marker-end="url(#ah)"/>
      ${label(320, 260, "Zero-shot: no task labels — strong generalization from scale alone", "#132028", 10)}
      ${["7× bigger than GPT-1", "1.5 B parameters", "WebText: 40 GB", "Zero-shot SOTA"].map((stat, i) => {
        const x = 50 + i * 150;
        return box(x, 268, 135, 24, "#1f6b54", 5) + lbl(x + 67, 284, stat, "#e8f8f2", 8);
      }).join("")}`),

    // ── GPT-3 scale + few-shot diagram ───────────────────────────────────
    "gpt3-2020": mkSvg(`
      ${bg}
      ${label(320, 18, "GPT-3 — Few-Shot Learners at Scale · Brown et al. 2020", "#132028", 12)}
      ${label(100, 42, "Model Scale", "#132028", 10)}
      ${[["GPT-1", "0.12B", 10, "#4c8ac0"], ["GPT-2", "1.5B", 40, "#205ea6"],
         ["GPT-3", "175B", 180, "#9e2f2f"]].map(([name, size, barW, col], i) => {
        const y = 55 + i * 52;
        return box(20, y, barW, 36, col, 4) +
               lbl(20 + barW / 2, y + 23, name, "#fff", 9) +
               `<text x="${26 + barW}" y="${y + 23}" font-family="monospace" font-size="10" fill="${col}">${size} params</text>`;
      }).join("")}
      <line x1="20" y1="215" x2="600" y2="215" stroke="#132028" stroke-width="1.5"/>
      ${label(310, 228, "Scale →", "#132028", 9)}
      ${box(230, 40, 390, 160, "#f5f9f2", 8, "#1f6b54", 2)}
      ${label(425, 58, "In-Context Few-Shot Learning", "#1f6b54", 10)}
      ${box(240, 65, 370, 25, "#dce8f5", 4, "#205ea6", 1)}
      ${label(425, 82, "Prompt: Q: Capital of France? A: Paris", "#205ea6", 8)}
      ${box(240, 96, 370, 25, "#dce8f5", 4, "#205ea6", 1)}
      ${label(425, 113, "Prompt: Q: Capital of Italy? A: Rome", "#205ea6", 8)}
      ${box(240, 127, 370, 25, "#f5dede", 4, "#9e2f2f", 1)}
      ${label(425, 144, "Query:  Q: Capital of Spain? A: →", "#9e2f2f", 8)}
      ${box(240, 158, 370, 28, "#1f6b54", 4)}
      ${lbl(425, 177, "Output: Madrid  (no gradient updates, no fine-tuning)", "#e8f8f2", 8)}
      ${label(320, 248, "175B parameters · 96 attention layers · 96 heads · trained on 300B tokens", "#132028", 9)}
      ${label(320, 268, "Few-shot matches fine-tuned BERT on many NLP benchmarks", "#132028", 9)}
      ${label(320, 286, "Cemented scaling laws and prompt-based usage as primary paradigm", "#4c8ac0", 9)}`),

    // ── Scaling laws log-log curve ────────────────────────────────────────
    "scaling-laws-2020": mkSvg(`
      ${bg}
      ${label(320, 18, "Scaling Laws for Neural Language Models · Kaplan et al. 2020", "#132028", 12)}
      ${box(60, 30, 520, 220, "#f8f8f8", 6, "#c8d2cf", 1)}
      <line x1="90" y1="38" x2="90" y2="238" stroke="#132028" stroke-width="2"/>
      <line x1="90" y1="238" x2="558" y2="238" stroke="#132028" stroke-width="2"/>
      ${label(68, 135, "Loss", "#132028", 10)}
      ${label(324, 258, "Scale  (Compute / Model Size / Dataset)", "#132028", 10)}
      ${["10⁰","10⁻¹","10⁻²"].map((lbl2, i) =>
        `<text x="64" y="${70 + i * 84}" text-anchor="end" font-family="monospace" font-size="8" fill="#4a5d66">${lbl2}</text>
         <line x1="88" y1="${66 + i * 84}" x2="92" y2="${66 + i * 84}" stroke="#132028" stroke-width="1.5"/>`
      ).join("")}
      ${["10³", "10⁶", "10⁹", "10¹²"].map((lbl2, i) =>
        `<text x="${145 + i * 110}" y="252" text-anchor="middle" font-family="monospace" font-size="8" fill="#4a5d66">${lbl2}</text>
         <line x1="${145 + i * 110}" y1="236" x2="${145 + i * 110}" y2="240" stroke="#132028" stroke-width="1.5"/>`
      ).join("")}
      <path d="M 110,58 C 180,80 240,110 310,143 C 370,167 430,185 540,210" stroke="#9e2f2f" stroke-width="3" fill="none"/>
      <path d="M 110,68 C 190,92 260,118 330,150 C 390,172 450,190 540,214" stroke="#205ea6" stroke-width="2.5" fill="none" stroke-dasharray="6,3"/>
      <path d="M 110,78 C 200,106 270,132 350,158 C 410,175 465,193 540,218" stroke="#1f6b54" stroke-width="2" fill="none" stroke-dasharray="3,3"/>
      ${box(360, 50, 180, 22, "#9e2f2f", 4)} ${lbl(450, 65, "Model parameters (N)")}
      ${box(360, 78, 180, 22, "#205ea6", 4)} ${lbl(450, 93, "Compute budget (C)")}
      ${box(360, 106, 180, 22, "#1f6b54", 4)} ${lbl(450, 121, "Dataset size (D)")}
      ${box(360, 134, 180, 22, "#c66b2f", 4)}
      ${lbl(450, 149, "All follow power-law")}
      ${label(320, 278, "Loss ∝ N⁻ᵅ · C⁻β · D⁻γ  — predictable scaling enables planning", "#132028", 10)}
      ${label(320, 295, "Shapes capex decisions: larger models + less data beats smaller + more data at fixed compute", "#4a5d66", 8)}`),

    // ── Megatron-LM: GPU grid / tensor + pipeline parallel ───────────────
    "megatron-lm-2019": mkSvg(`
      ${bg}
      ${label(320, 18, "Megatron-LM — Tensor &amp; Pipeline Parallelism · Shoeybi et al. 2019", "#132028", 11)}
      ${label(120, 36, "Tensor Parallel (columns) →", "#205ea6", 9)}
      ${label(28, 160, "Pipeline Parallel (rows)", "#9e2f2f", 9)}
      ${[0,1,2,3].flatMap(row =>
        [0,1,2,3].map(col => {
          const x = 80 + col * 110, y = 50 + row * 55;
          const fills = ["#205ea6","#4c8ac0","#1f6b54","#3a8c6e"];
          return box(x, y, 95, 42, fills[col], 6) +
                 lbl(x + 47, y + 18, `GPU ${row*4+col+1}`, "#fff", 10) +
                 lbl(x + 47, y + 33, `T${col+1} · P${row+1}`, "#e8e8ff", 8);
        })
      ).join("")}
      ${[0,1,2].map(col =>
        `<line x1="${176 + col*110}" y1="${152}" x2="${183 + col*110}" y2="${152}" stroke="#c66b2f" stroke-width="1.5" marker-end="url(#ah)"/>`
      ).join("")}
      ${[0,1,2].map(row =>
        `<line x1="${80}" y1="${95 + row*55}" x2="${80}" y2="${100 + row*55}" stroke="#c66b2f" stroke-width="1.5" marker-end="url(#ah)"/>`
      ).join("")}
      ${box(80, 282, 420, 10, "none", 0, "#c66b2f", 0)}
      ${label(320, 250, "Tensor slices: weight matrices split column-wise across GPUs in each stage", "#205ea6", 9)}
      ${label(320, 265, "Pipeline stages: layer groups assigned to rows — micro-batches flow through", "#9e2f2f", 9)}
      ${label(320, 282, "Combines both strategies: scales to multi-billion parameter models on GPU clusters", "#132028", 9)}
      ${label(320, 296, "NVLink / NVSwitch bandwidth and InfiniBand fabric are critical bottlenecks", "#4a5d66", 8)}`),

    // ── ZeRO memory partitioning diagram ─────────────────────────────────
    "zero-2020": mkSvg(`
      ${bg}
      ${label(320, 18, "ZeRO Memory Optimizations · Rajbhandari et al. 2020", "#132028", 12)}
      ${label(320, 33, "Partitioning optimizer states, gradients, and parameters across workers", "#4a5d66", 9)}
      ${["Optimizer States", "Gradients", "Parameters"].map((seg, si) => {
        const fills = ["#205ea6", "#4c8ac0", "#1f6b54"];
        return `<text x="${120 + si*160}" y="55" text-anchor="middle" font-family="monospace" font-size="10" font-weight="bold" fill="${fills[si]}">${seg}</text>`;
      }).join("")}
      ${[0,1,2,3].flatMap(worker => {
        const y = 65 + worker * 52;
        return [
          box(20, y, 600, 42, "#f8fbf9", 6, "#c8d2cf", 1),
          `<text x="12" y="${y + 26}" text-anchor="end" font-family="monospace" font-size="9" fill="#132028">W${worker+1}</text>`,
          ...["#205ea6","#4c8ac0","#1f6b54"].map((fill, si) => {
            const partW = 160; const px = 30 + si * partW;
            const active = (si === 0) || (si <= 1 && worker < 2) || worker === 0;
            return box(px + worker * 10, y + 6, partW - 14, 28, fill, 4, "none", 1, active ? 1 : 0.28) +
                   lbl(px + worker * 10 + (partW - 14)/2, y + 24,
                       si === 0 ? `Shard ${worker+1}/4` : si === 1 ? `Grad ${worker+1}/4` : `Param ${worker+1}/4`,
                       active ? "#fff" : "#aaa", 8);
          })
        ];
      }).join("")}
      <line x1="30" y1="280" x2="610" y2="280" stroke="#c8d2cf" stroke-width="1"/>
      ${box(30, 255, 130, 20, "#9e2f2f", 4)} ${lbl(95, 269, "Stage 1: Opt States")}
      ${box(175, 255, 130, 20, "#c66b2f", 4)} ${lbl(240, 269, "Stage 2: + Grads")}
      ${box(320, 255, 130, 20, "#1f6b54", 4)} ${lbl(385, 269, "Stage 3: + Params")}
      ${label(180, 296, "≈4× memory saving", "#9e2f2f", 9)}
      ${label(385, 296, "≈8× memory saving", "#c66b2f", 9)}
      ${label(565, 296, "linear saving", "#1f6b54", 9)}`),

    // ── GShard sparse MoE routing ─────────────────────────────────────────
    "gshard-2020": mkSvg(`
      ${bg}
      ${label(320, 18, "GShard — Sparse MoE Scaling with Auto-Sharding · Lepikhin et al. 2020", "#132028", 11)}
      ${label(320, 34, "Tokens route to top-2 of N experts — only active experts compute", "#4a5d66", 9)}
      ${["E1","E2","E3","E4","E5","E6","E7","E8"].map((e, i) => {
        const x = 30 + i * 74;
        return box(x, 45, 62, 36, "#205ea6", 6) + lbl(x + 31, 68, e, "#e8f4ff", 10);
      }).join("")}
      ${["T1","T2","T3","T4","T5","T6","T7","T8"].map((t, i) => {
        const x = 30 + i * 74; const routes = [[0,2],[1,3],[0,4],[2,5],[1,6],[3,7],[0,3],[4,6]];
        const [r1, r2] = routes[i];
        return box(x, 220, 62, 36, "#9e2f2f", 6) + lbl(x + 31, 243, t, "#ffe8e8", 10) +
          `<line x1="${x+31}" y1="220" x2="${30 + r1*74 + 31}" y2="81" stroke="#c66b2f" stroke-width="1.8" marker-end="url(#ah)"/>` +
          `<line x1="${x+31}" y1="220" x2="${30 + r2*74 + 31}" y2="81" stroke="#c66b2f" stroke-width="1.2" stroke-dasharray="4,2" marker-end="url(#ah)"/>`;
      }).join("")}
      ${label(320, 205, "8 tokens · each routes to top-2 experts (gating network)", "#c66b2f", 9)}
      ${label(320, 270, "6 of 8 experts active per token — 75% experts idle per token decision", "#205ea6", 9)}
      ${label(320, 284, "Expert capacity + auxiliary load-balancing loss prevent routing collapse", "#4a5d66", 9)}
      ${label(320, 298, "Auto-sharding places experts across TPU slices — sparse all-to-all communication", "#9e2f2f", 9)}`),

    // ── Switch Transformer top-1 routing ─────────────────────────────────
    "switch-2021": mkSvg(`
      ${bg}
      ${label(320, 18, "Switch Transformer — Top-1 Expert Routing · Fedus et al. 2021", "#132028", 12)}
      ${["E0","E1","E2","E3","E4","E5"].map((e, i) => {
        const x = 60 + i * 90;
        return box(x, 40, 75, 38, "#205ea6", 6) + lbl(x + 37, 64, e, "#e8f4ff", 10);
      }).join("")}
      ${[0,2,1,4,3,5].map((expert, i) => {
        const tx = 60 + i * 90, ex = 60 + expert * 90;
        return box(tx, 200, 75, 38, "#9e2f2f", 6) + lbl(tx + 37, 224, `Token ${i+1}`, "#ffe8e8", 9) +
          `<line x1="${tx+37}" y1="200" x2="${ex+37}" y2="78" stroke="#c66b2f" stroke-width="2.5" marker-end="url(#ah)"/>`;
      }).join("")}
      ${box(200, 148, 240, 28, "#1f6b54", 6)}
      ${lbl(320, 167, "Gate: top-1 selection (router)")}
      ${label(320, 255, "Each token picks exactly ONE expert — simplest possible routing", "#c66b2f", 10)}
      ${label(320, 270, "Auxiliary load-balancing loss keeps expert utilization uniform", "#205ea6", 9)}
      ${label(320, 284, "Scales to 1.6 T parameters — 7× faster than T5 at equal quality", "#1f6b54", 9)}
      ${label(320, 298, "Resolves GShard complexity: no top-2, no capacity buffer tuning needed", "#4a5d66", 9)}`),

    // ── PaLM cluster scale diagram ────────────────────────────────────────
    "palm-2022": mkSvg(`
      ${bg}
      ${label(320, 18, "PaLM — Pathways Language Model · Chowdhery et al. 2022", "#132028", 12)}
      ${box(20, 28, 600, 220, "#f0f8f4", 8, "#1f6b54", 2)}
      ${label(320, 44, "Pathways Training Cluster — 6144 TPU v4 chips", "#1f6b54", 10)}
      ${[0,1].map(pod =>
        box(30 + pod * 300, 52, 275, 180, "#e0f2e8", 7, "#1f6b54", 1.5) +
        label(167 + pod * 300, 68, `Pod ${pod+1}`, "#1f6b54", 10)
      ).join("")}
      ${[0,1].flatMap(pod =>
        [0,1,2].flatMap(row =>
          [0,1,2,3].map(col => {
            const x = 40 + pod * 300 + col * 60; const y = 78 + row * 46;
            return box(x, y, 50, 34, "#205ea6", 4) + lbl(x + 25, y + 22, `TPU`, "#e8f4ff", 9);
          })
        )
      ).join("")}
      ${label(320, 258, "540 B dense parameters · 2-way data parallelism across pods, 12-way pipeline within pod", "#132028", 9)}
      ${label(320, 272, "Checkpoint resilience: days-long runs with automated fault recovery", "#4a5d66", 9)}
      ${label(320, 286, "One model: 5-shot SOTA on 28 of 29 language benchmarks", "#9e2f2f", 9)}
      ${label(320, 298, "BIG-bench hard tasks show chain-of-thought reasoning emerges with scale", "#c66b2f", 9)}`),

    // ── FlashAttention IO-aware tiling ───────────────────────────────────
    "flashattention-2022": mkSvg(`
      ${bg}
      ${label(320, 18, "FlashAttention — IO-Aware Exact Attention · Dao et al. 2022", "#132028", 12)}
      ${box(30, 30, 270, 220, "#f5dede", 8, "#9e2f2f", 2)}
      ${label(165, 48, "GPU HBM (large, slow)", "#9e2f2f", 10)}
      ${label(165, 62, "40–80 GB · ~2 TB/s bandwidth", "#9e2f2f", 8)}
      ${[["Query (Q)", "#c26060"], ["Key (K)", "#c26060"], ["Value (V)", "#c26060"],
        ["Attention Matrix (N²)", "#9e2f2f"], ["Output (O)", "#c26060"]].map(([lbl2, fill], i) =>
        box(45, 72 + i * 36, 220, 28, fill, 4) + lbl(155, 92 + i * 36, lbl2)
      ).join("")}
      ${box(330, 30, 280, 220, "#dce8f5", 8, "#205ea6", 2)}
      ${label(470, 48, "GPU SRAM (small, fast)", "#205ea6", 10)}
      ${label(470, 62, "20 MB · ~19 TB/s bandwidth", "#205ea6", 8)}
      ${[["Tile of Q", "#205ea6"], ["Tile of K", "#205ea6"], ["Tile of V", "#205ea6"],
        ["Softmax (online)", "#4c8ac0"], ["Output tile", "#205ea6"]].map(([lbl2, fill], i) =>
        box(345, 72 + i * 36, 250, 28, fill, 4) + lbl(470, 92 + i * 36, lbl2)
      ).join("")}
      ${[0,1,2,3,4].map(i => `<line x1="265" y1="${86 + i*36}" x2="330" y2="${86 + i*36}" stroke="#c66b2f" stroke-width="1.8" marker-end="url(#ah)"/>`).join("")}
      ${label(320, 262, "Standard attention: O(N²) HBM reads/writes for N sequence length", "#9e2f2f", 9)}
      ${label(320, 276, "FlashAttention: tile into SRAM blocks — recompute during backward, no N² materialization", "#205ea6", 9)}
      ${label(320, 290, "2–4× training speedup · 10–20× memory saving on long sequences", "#1f6b54", 9)}
      ${label(320, 304, "Exact result — no approximation, same outputs as standard attention", "#c66b2f", 9)}`),

    // ── LLaMA model family efficiency chart ──────────────────────────────
    "llama-2023": mkSvg(`
      ${bg}
      ${label(320, 18, "LLaMA — Open Foundation Models · Touvron et al. 2023", "#132028", 12)}
      ${label(320, 33, "Competitive quality-per-parameter at every scale: open and accessible", "#4a5d66", 9)}
      ${[["LLaMA 65B", 360, "#9e2f2f", "Matches GPT-3 175B"], ["LLaMA 30B", 270, "#c26060", "Surpasses Gopher 280B"],
        ["LLaMA 13B", 180, "#205ea6", "Outperforms GPT-3 on most tasks"], ["LLaMA 7B", 110, "#4c8ac0", "Strong small-scale baseline"]
      ].map(([name, barW, fill, note], i) => {
        const y = 50 + i * 52;
        return box(120, y, barW, 36, fill, 5) +
               lbl(120 + barW / 2, y + 23, name, "#fff", 10) +
               `<text x="${128 + barW}" y="${y + 23}" font-family="monospace" font-size="8" fill="${fill}">${note}</text>`;
      }).join("")}
      <line x1="120" y1="260" x2="520" y2="260" stroke="#132028" stroke-width="1.5" marker-end="url(#ah)"/>
      ${label(320, 274, "Performance →", "#132028", 9)}
      ${box(30, 282, 580, 14, "#f5f9f2", 4, "#1f6b54", 1)}
      ${label(320, 293, "Trained on 1T+ tokens from public data: Common Crawl · GitHub · Wikipedia · Books · ArXiv", "#1f6b54", 8)}
      ${label(320, 306, "Open release accelerated fine-tuning ecosystem: Alpaca, Vicuna, WizardLM, CodeLlama…", "#c66b2f", 8)}`),

    // ── vLLM PagedAttention KV cache paging ──────────────────────────────
    "vllm-2023": mkSvg(`
      ${bg}
      ${label(320, 18, "PagedAttention (vLLM) — KV Cache Serving · Kwon et al. 2023", "#132028", 11)}
      ${label(320, 34, "Logical KV blocks map to non-contiguous physical GPU memory pages", "#4a5d66", 9)}
      ${box(20, 48, 290, 130, "#dce8f5", 6, "#205ea6", 1.5)}
      ${label(165, 62, "Logical KV Cache (per request)", "#205ea6", 9)}
      ${[0,1,2,3,4].map(i => box(30 + i * 56, 70, 50, 30, "#205ea6", 4) + lbl(55 + i * 56, 90, `B${i+1}`, "#e8f4ff", 10)).join("")}
      ${[0,1,2,3,4].map(i => box(30 + i * 56, 106, 50, 30, "#4c8ac0", 4) + lbl(55 + i * 56, 126, `B${i+6}`, "#e8f4ff", 10)).join("")}
      ${label(165, 148, "Req A and Req B — contiguous logical view", "#205ea6", 8)}
      ${box(330, 48, 290, 200, "#f5dede", 6, "#9e2f2f", 1.5)}
      ${label(475, 62, "Physical GPU Memory Blocks", "#9e2f2f", 9)}
      ${[["A·B1","#205ea6"],["A·B2","#205ea6"],["B·B1","#9e2f2f"],["A·B3","#205ea6"],
        ["FREE","#aaa"],["B·B2","#9e2f2f"],["A·B4","#205ea6"],["FREE","#aaa"],
        ["B·B3","#9e2f2f"],["A·B5","#205ea6"],["B·B4","#9e2f2f"],["FREE","#aaa"]].map(([lbl2, fill], i) => {
        const px = 340 + (i % 4) * 66; const py = 70 + Math.floor(i/4) * 44;
        return box(px, py, 58, 34, fill, 4) + lbl(px + 29, py + 22, lbl2, lbl2 === "FREE" ? "#888" : "#fff", 8);
      }).join("")}
      ${label(475, 235, "Non-contiguous physical blocks — no fragmentation", "#9e2f2f", 8)}
      ${box(20, 185, 290, 60, "#f5f9f2", 6, "#1f6b54", 1.5)}
      ${label(165, 200, "Page Table", "#1f6b54", 9)}
      ${label(165, 218, "Logical block → physical block mapping", "#1f6b54", 8)}
      ${label(165, 232, "Copy-on-write for beam search sharing", "#c66b2f", 8)}
      ${label(320, 268, "2–4× higher throughput vs HuggingFace Transformers · near-zero memory waste", "#132028", 9)}
      ${label(320, 282, "Serves parallel requests efficiently by sharing physical pages across sequences", "#205ea6", 9)}
      ${label(320, 296, "Enables long sequence + high concurrency serving without OOM", "#1f6b54", 9)}`),

    // ── Mistral 7B GQA + sliding window diagram ──────────────────────────
    "mistral-7b-2023": mkSvg(`
      ${bg}
      ${label(320, 18, "Mistral 7B — Efficient Architecture · Jiang et al. 2023", "#132028", 12)}
      ${box(20, 28, 285, 230, "#dce8f5", 8, "#205ea6", 2)}
      ${label(162, 46, "Grouped Query Attention (GQA)", "#205ea6", 10)}
      ${label(162, 60, "8 Q heads share 2 KV heads", "#4a5d66", 8)}
      ${[0,1,2,3,4,5,6,7].map(i => box(30 + i * 32, 68, 26, 20, "#205ea6", 3) + lbl(43 + i * 32, 83, `Q`, "#e8f4ff", 8)).join("")}
      ${[0,1].map(i => box(74 + i * 128, 104, 100, 24, "#9e2f2f", 4) + lbl(124 + i * 128, 121, `KV head ${i+1}`, "#ffe8e8", 9)).join("")}
      ${[0,1,2,3].map(qh =>
        `<line x1="${43 + qh*32}" y1="88" x2="${124}" y2="104" stroke="#c66b2f" stroke-width="1.2" stroke-dasharray="3,2"/>`
      ).join("")}
      ${[4,5,6,7].map(qh =>
        `<line x1="${43 + qh*32}" y1="88" x2="${252}" y2="104" stroke="#c66b2f" stroke-width="1.2" stroke-dasharray="3,2"/>`
      ).join("")}
      ${label(162, 145, "4× fewer KV cache entries — lower memory, higher throughput", "#1f6b54", 8)}
      ${box(30, 155, 250, 22, "#1f6b54", 4)} ${lbl(155, 171, "4096 context (long-context friendly)")}
      ${box(30, 183, 250, 22, "#1f6b54", 4)} ${lbl(155, 199, "Sliding Window Attention (SWA)")}
      ${box(30, 211, 250, 22, "#205ea6", 4)} ${lbl(155, 227, "32 layers · 4096 dim · 32K vocab")}
      ${box(330, 28, 280, 230, "#f5f9f2", 8, "#1f6b54", 2)}
      ${label(470, 46, "Sliding Window Attention", "#1f6b54", 10)}
      ${label(470, 60, "window = 4096, each pos attends to last W", "#4a5d66", 8)}
      ${[0,1,2,3,4,5,6,7].map(row =>
        [0,1,2,3,4,5,6,7].map(col => {
          const attended = col >= row - 2 && col <= row;
          return box(338 + col * 32, 70 + row * 19, 30, 17,
                     attended ? (col === row ? "#9e2f2f" : "#205ea6") : "#e8eef5", 2);
        }).join("")
      ).join("")}
      ${label(470, 226, "Causal diagonal + local window band", "#1f6b54", 8)}
      ${label(320, 274, "Outperforms LLaMA 2 13B on most benchmarks at 7B parameter count", "#132028", 9)}
      ${label(320, 288, "GQA + SWA: excellent quality-per-compute for inference-focused deployments", "#205ea6", 9)}
      ${label(320, 302, "Sliding window: O(N·W) vs O(N²) attention — practical for long generations", "#1f6b54", 9)}`),

    // ── DBRX fine-grain MoE ───────────────────────────────────────────────
    "dbrx-2024": mkSvg(`
      ${bg}
      ${label(320, 18, "DBRX — Fine-Grain MoE · Databricks 2024", "#132028", 12)}
      ${label(320, 33, "132B total parameters · 36B active per forward pass · top-4 of 16 experts", "#4a5d66", 9)}
      ${label(320, 48, "16 Experts per MoE Layer", "#205ea6", 10)}
      ${[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(i => {
        const active = [0,3,7,11].includes(i);
        const x = 20 + (i % 8) * 75; const y = 58 + Math.floor(i/8) * 45;
        return box(x, y, 64, 36, active ? "#9e2f2f" : "#b8cfe8", 5) +
               lbl(x + 32, y + 23, `E${i+1}`, active ? "#fff" : "#666", 9);
      }).join("")}
      ${box(200, 155, 240, 28, "#c66b2f", 6)} ${lbl(320, 174, "Router: token → top-4 selection")}
      ${box(200, 190, 240, 28, "#9e2f2f", 6)} ${lbl(320, 209, "Active: E1 · E4 · E8 · E12 (36B)")}
      ${box(200, 225, 240, 28, "#205ea6", 6)} ${lbl(320, 244, "Inactive: 12 experts idle (96B)")}
      ${label(20, 262, "Fine-grain MoE advantage:", "#132028", 10)}
      ${label(320, 262, "More experts = better specialization + lower per-token FLOP", "#9e2f2f", 9)}
      ${box(20, 270, 600, 18, "#f5f9f2", 4, "#1f6b54", 1)}
      ${label(320, 282, "16 experts (fine) vs 8 experts (coarse) — finer routing = richer capacity at same active compute", "#1f6b54", 8)}
      ${label(320, 297, "Outperforms LLaMA 2 70B, Mixtral 8×7B on standard benchmarks", "#9e2f2f", 9)}
      ${label(320, 311, "MoE inference: bandwidth-bound expert dispatch needs high-speed fabric (IB / NVLink)", "#4a5d66", 8)}`)
  };

  return diagrams;
}

function getPaperDiagramDataUri(paper) {
  if (!_diagramCache) _diagramCache = _buildDiagramCache();
  const svgBody = _diagramCache[paper.id];
  if (!svgBody) return paperImageDataUri(paper);
  return svgBody;
}

const feedEl = document.getElementById("paperFeed");
const discoveryFeedEl = document.getElementById("discoveryFeed");
const discoveryCountEl = document.getElementById("discoveryCount");
const discoveryQueryEl = document.getElementById("discoveryQuery");
const discoveryStatusEl = document.getElementById("discoveryStatus");
const findNewPapersBtn = document.getElementById("findNewPapersBtn");
const detailEl = document.getElementById("selectedDetail");
const sectionEl = document.getElementById("fullSections");
const feedCountEl = document.getElementById("feedCount");
const filterButtons = [...document.querySelectorAll(".filter-btn")];

const discoveryQuery = "Latest AI White Papers LLMs DeepSkeek Arhitecture Mixture Of Experts Data Flow";
let activeFilter = "all";
let selectedPaperId = papers[0].id;

function groupLabel(group) {
  if (group === "important") return "Most Important";
  if (group === "read") return "Most Read";
  if (group === "latest") return "Latest";
  return group;
}

function groupClass(group) {
  return group;
}

function linkLabel(paper) {
  if (paper.isDiscovery) return "Open Discovery Source";
  return paper.isLocal ? "Open Local PDF" : "Read Original Paper";
}

function rebuildPapers() {
  staticRepositoryPapers = [...curatedPapers, ...dynamicLocalPapers];
  papers = [...discoveredWebPapers, ...staticRepositoryPapers];

  if (!papers.some((item) => item.id === selectedPaperId) && papers.length > 0) {
    selectedPaperId = papers[0].id;
  }
}

// Reads window.localPapersManifest set by papers-manifest.js (works from file://).
// Adds any new PDFs not yet in the feed and re-renders only when something changed.
function refreshLocalPapersFromManifest() {
  const files = Array.isArray(window.localPapersManifest) ? window.localPapersManifest : [];
  if (files.length === 0) return;

  const existingIds = new Set(dynamicLocalPapers.map((p) => p.id));
  const newFiles = files.filter((f) => !existingIds.has(`local-${slugify(f)}`));

  if (newFiles.length === 0) return; // nothing new

  localPaperFiles = files;
  dynamicLocalPapers = buildLocalPapers(files);
  rebuildPapers();
  renderFeed();
  renderDetail();
  renderFullSections();
  console.log(`Local papers refreshed — ${dynamicLocalPapers.length} total (${newFiles.length} new)`);
}

function cleanAbstract(rawAbstract) {
  if (!rawAbstract) return "";
  return rawAbstract
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferDatacenterImpact(text) {
  const lower = text.toLowerCase();

  if (lower.includes("mixture") || lower.includes("moe") || lower.includes("expert")) {
    return "This likely affects sparse routing behavior, all-to-all traffic patterns, and cluster scheduling strategy for MoE workloads.";
  }

  if (lower.includes("inference") || lower.includes("serving") || lower.includes("latency")) {
    return "This is likely relevant to serving economics, memory footprint control, and latency-throughput tuning in production datacenters.";
  }

  if (lower.includes("dataflow") || lower.includes("interconnect") || lower.includes("memory")) {
    return "This likely impacts memory hierarchy design, interconnect utilization, and accelerator data movement efficiency.";
  }

  return "This likely provides useful guidance for balancing quality, throughput, and total infrastructure cost in enterprise AI clusters.";
}

function inferKeyResult(text, year) {
  const numberMatch = text.match(/\b\d+(?:\.\d+)?\s?(?:x|%|b|m|tokens|gpu|gpus|ms)\b/i);
  if (numberMatch) {
    return `Key result signal: reported metric includes ${numberMatch[0]}, indicating measurable system or model impact.`;
  }

  return `Key result signal: recent (${year}) technical contribution with architecture relevance worth deeper validation.`;
}

function toDiscoveryPaper(entry, index) {
  const abstract = cleanAbstract(entry.abstract || "");
  const title = (entry.title || "Untitled discovery paper").trim();
  const year = Number(entry.year) || new Date().getFullYear();
  const authors = Array.isArray(entry.authors) && entry.authors.length > 0
    ? entry.authors.slice(0, 3).map((a) => a.name).join(", ")
    : "Web Discovery";
  const url = entry.url || (entry.externalIds && entry.externalIds.ArXiv ? `https://arxiv.org/abs/${entry.externalIds.ArXiv}` : "https://www.semanticscholar.org/");
  const summaryBase = abstract.length > 0
    ? abstract.slice(0, 320)
    : "This result was discovered from the live search query and appears relevant to LLM architecture, MoE, or dataflow optimization.";

  return {
    id: `web-live-${slugify(`${title}-${year}-${index}`)}`,
    title,
    authors,
    year,
    groups: ["latest", "read"],
    preview: summaryBase.slice(0, 148),
    summary: `${summaryBase}${summaryBase.endsWith(".") ? "" : "."}`,
    datacenter: inferDatacenterImpact(`${title} ${summaryBase}`),
    metrics: inferKeyResult(summaryBase, year),
    link: url,
    isDiscovery: true
  };
}

// Reconstruct plain-text abstract from OpenAlex inverted-index format
function reconstructAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== "object") return "";
  const words = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }
  return words.filter(Boolean).join(" ");
}

// Map an OpenAlex work object to our internal paper model
function toDiscoveryPaperFromOpenAlex(entry, index) {
  const title = (entry.title || "Untitled discovery paper").trim();
  const year = entry.publication_date
    ? parseInt(entry.publication_date.slice(0, 4), 10)
    : new Date().getFullYear();
  const authors =
    Array.isArray(entry.authorships) && entry.authorships.length > 0
      ? entry.authorships
          .slice(0, 3)
          .map((a) => a.author?.display_name)
          .filter(Boolean)
          .join(", ")
      : "Web Discovery";
  const link =
    entry.open_access?.oa_url ||
    (entry.doi ? entry.doi : "https://openalex.org");
  const abstract = cleanAbstract(reconstructAbstract(entry.abstract_inverted_index));
  const summaryBase =
    abstract.length > 60
      ? abstract.slice(0, 320)
      : "This result was discovered from the live search and appears relevant to LLM architecture, MoE, or dataflow optimization.";

  return {
    id: `web-live-${slugify(`${title}-${year}-${index}`)}`,
    title,
    authors,
    year,
    groups: ["latest", "read"],
    preview: summaryBase.slice(0, 148),
    summary: `${summaryBase}${summaryBase.endsWith(".") ? "" : "."}`,
    datacenter: inferDatacenterImpact(`${title} ${summaryBase}`),
    metrics: inferKeyResult(summaryBase, year),
    link,
    isDiscovery: true
  };
}

// Map an arXiv Atom <entry> element to our internal paper model
function toDiscoveryPaperFromArxiv(entry, index) {
  const getEl = (tag) => entry.getElementsByTagName(tag)[0]?.textContent?.trim() || "";
  const title = getEl("title").replace(/\s+/g, " ");
  const abstract = getEl("summary").replace(/\s+/g, " ");
  const published = getEl("published");
  const year = published ? parseInt(published.slice(0, 4), 10) : new Date().getFullYear();
  const link = getEl("id") || "https://arxiv.org";
  const authorEls = [...entry.getElementsByTagName("name")];
  const authors = authorEls.slice(0, 3).map((n) => n.textContent.trim()).join(", ") || "arXiv Discovery";

  const summaryBase = abstract.length > 60
    ? cleanAbstract(abstract).slice(0, 320)
    : "This result was discovered from arXiv and appears relevant to LLM architecture, MoE, or dataflow optimization.";

  return {
    id: `web-live-${slugify(`${title}-${year}-arxiv-${index}`)}`,
    title,
    authors,
    year,
    groups: ["latest", "read"],
    preview: summaryBase.slice(0, 148),
    summary: `${summaryBase}${summaryBase.endsWith(".") ? "" : "."}`,
    datacenter: inferDatacenterImpact(`${title} ${summaryBase}`),
    metrics: inferKeyResult(summaryBase, year),
    link,
    isDiscovery: true
  };
}

// Rotating topic queries — advances one slot per search click for variety
const _discoveryQueryPool = [
  "LLM transformer architecture mixture of experts attention mechanism",
  "large language model inference serving GPU efficiency",
  "mixture of experts sparse neural network scaling",
  "flash attention KV cache transformer memory optimization",
  "LLM quantization compression fine-tuning efficiency",
  "distributed training data parallelism model architecture",
  "AI inference throughput latency serving datacenter optimization",
  "foundation model pretraining scaling laws emergent capabilities",
];
let _discoveryQueryIndex = 0;

// Returns an ISO date string for N months in the past (e.g. "2024-09-23")
function _monthsAgoDate(months) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

// Uses OpenAlex (primary) + arXiv (secondary) — both support CORS from any origin including file://
async function fetchDiscoveredPapers() {
  const queryText = _discoveryQueryPool[_discoveryQueryIndex % _discoveryQueryPool.length];
  _discoveryQueryIndex++;

  const since = _monthsAgoDate(18);
  const openAlexUrl = `https://api.openalex.org/works?search=${encodeURIComponent(
    queryText
  )}&sort=publication_date:desc&filter=publication_date:>${since}&per-page=15`;

  const arxivUrl = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(
    "cat:cs.LG AND (transformer OR llm OR \"mixture of experts\" OR attention OR architecture)"
  )}&sortBy=submittedDate&sortOrder=descending&max_results=8`;

  const [openAlexResult, arxivResult] = await Promise.allSettled([
    fetch(openAlexUrl, { headers: { Accept: "application/json" } }),
    fetch(arxivUrl),
  ]);

  const results = [];

  if (openAlexResult.status === "fulfilled" && openAlexResult.value.ok) {
    const payload = await openAlexResult.value.json();
    const rows = Array.isArray(payload.results) ? payload.results : [];
    results.push(...rows.map((entry, i) => toDiscoveryPaperFromOpenAlex(entry, i)));
  }

  if (arxivResult.status === "fulfilled" && arxivResult.value.ok) {
    const xml = await arxivResult.value.text();
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const entries = [...doc.getElementsByTagName("entry")];
    results.push(...entries.map((entry, i) => toDiscoveryPaperFromArxiv(entry, results.length + i)));
  }

  if (results.length === 0) throw new Error("No results from OpenAlex or arXiv");
  return results;
}

function dedupeDiscoveredPapers(nextPapers) {
  const seenTitles = new Set();
  const merged = [...nextPapers, ...discoveredWebPapers].filter((item) => {
    const key = item.title.toLowerCase().trim();
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });

  return merged.slice(0, 24);
}

async function handleFindNewPapers() {
  if (!findNewPapersBtn) return;

  findNewPapersBtn.disabled = true;
  discoveryStatusEl.textContent = "Searching...";

  try {
    const fetched = await fetchDiscoveredPapers();

    if (fetched.length === 0) {
      discoveryStatusEl.textContent = "No results returned. Try again.";
      return;
    }

    discoveredWebPapers = dedupeDiscoveredPapers(fetched);
    rebuildPapers();
    renderDiscoveryFeed();
    renderFeed();
    renderDetail();
    renderFullSections();
    discoveryStatusEl.textContent = `Updated — ${fetched.length} results.`;
  } catch (error) {
    discoveryStatusEl.textContent = `Search failed: ${error.message}`;
  } finally {
    findNewPapersBtn.disabled = false;
  }
}

// ── Deterministic per-paper unique diagram ────────────────────────────────
// FNV-1a 32-bit hash — stable across calls for the same seed string
function _hashInt(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function paperImageDataUri(paper) {
  const seed = paper.id || paper.title || "default";

  // Linear congruential PRNG seeded from the paper's hash — fully deterministic
  let s = _hashInt(seed);
  function rnd() {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  }

  // XML-safe escaping for any dynamic text placed inside SVG <text> elements.
  // Raw & < > in SVG XML content cause "xmlParseEntityRef" browser parse errors.
  function xmlEsc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Topic detection — used only for the category label text
  const text = `${paper.title} ${paper.summary || ""} ${paper.datacenter || ""}`.toLowerCase();
  const topic =
    /mixture.of.expert|moe|expert routing|sparse.*expert/i.test(text)  ? "Mixture of Experts" :
    /kv.cache|pagedattn|paged attention/i.test(text)                    ? "KV Cache / Serving" :
    /memory|quantization|zero|compression/i.test(text)                  ? "Memory Optimization" :
    /inference|serving|latency|throughput/i.test(text)                  ? "Inference / Serving" :
    /gpu|tpu|accelerator|interconnect|nvlink|dataflow|photon/i.test(text)? "Hardware / Systems" :
    /agent|agentic|tool use|reasoning|chain.of.thought/i.test(text)     ? "Agentic AI" :
    /survey|benchmark|overview|evaluation/i.test(text)                  ? "Survey / Benchmark" :
    /training|gradient|optimizer|fine.tun|pretraining/i.test(text)      ? "Training Systems" :
    /attention|transformer|encoder|decoder/i.test(text)                 ? "Attention / Transformer" :
    /scaling|parameter|emergent/i.test(text)                            ? "Scaling + Emergence" :
                                                                          "AI Architecture";

  // 10 curated palettes: [dark, mid, accent, bg]
  const palettes = [
    ["#205ea6", "#4c8ac0", "#c66b2f", "#edf3fb"],  // blue / amber
    ["#9e2f2f", "#c26060", "#c66b2f", "#fdf0f0"],  // red / amber
    ["#1f6b54", "#3a8c6e", "#205ea6", "#edf7f2"],  // green / blue
    ["#c66b2f", "#d4894a", "#9e2f2f", "#fdf3ea"],  // amber / red
    ["#344c63", "#4a6b84", "#1f6b54", "#eaf2f7"],  // navy / green
    ["#5c3575", "#8054a0", "#c66b2f", "#f3edf8"],  // purple / amber
    ["#3a6b20", "#5e9c35", "#205ea6", "#eef8e4"],  // lime / blue
    ["#7a5228", "#a87840", "#9e2f2f", "#f8f0e0"],  // tan / red
    ["#2a5c6b", "#3d8096", "#c66b2f", "#e8f4f8"],  // teal / amber
    ["#4a3a6b", "#6b56a0", "#1f6b54", "#f0edf8"],  // indigo / green
  ];

  const pi = _hashInt(seed) % palettes.length;
  const [dark, mid, accent, bg] = palettes[pi];

  // ── Unique network graph — nodes + edges seeded by paper ID ──────────
  const nodeCount = 5 + Math.floor(rnd() * 5);          // 5 – 9 nodes
  const nodes = Array.from({ length: nodeCount }, () => ({
    x: 48 + rnd() * 544,
    y: 32 + rnd() * 188,
    r: 11 + rnd() * 19,
    shade: rnd()
  }));

  // Spanning chain + random extra edges
  const edges = [];
  const order = [...Array(nodeCount).keys()].sort(() => rnd() - 0.5);
  for (let i = 0; i < order.length - 1; i++) edges.push([order[i], order[i + 1]]);
  for (let i = 0; i < nodeCount; i++) {
    if (rnd() > 0.52) {
      const j = Math.floor(rnd() * nodeCount);
      if (j !== i) edges.push([i, j]);
    }
  }

  const edgesSvg = edges.map(([a, b]) => {
    const w = (1.2 + rnd() * 2.8).toFixed(1);
    const op = (0.3 + rnd() * 0.45).toFixed(2);
    return `<line x1="${nodes[a].x.toFixed(1)}" y1="${nodes[a].y.toFixed(1)}" x2="${nodes[b].x.toFixed(1)}" y2="${nodes[b].y.toFixed(1)}" stroke="${rnd() > 0.5 ? mid : accent}" stroke-width="${w}" opacity="${op}"/>`;
  }).join("");

  const nodesSvg = nodes.map((n, i) => {
    const fill = i === 0 ? dark : n.shade < 0.4 ? dark : n.shade < 0.7 ? mid : accent;
    const op = (0.72 + rnd() * 0.28).toFixed(2);
    return `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.r.toFixed(1)}" fill="${fill}" opacity="${op}"/>`;
  }).join("");

  // Optional decorative rings on two random nodes
  const ringsSvg = [0, Math.floor(rnd() * nodeCount)].map(i => {
    const n = nodes[i];
    return `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${(n.r + 8).toFixed(1)}" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.35"/>`;
  }).join("");

  const title      = xmlEsc(paper.title.replace(/&/g, "and").slice(0, 50));
  const authorLine = xmlEsc(`${(paper.authors || "").slice(0, 36).replace(/&/g, "and")} · ${paper.year}`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 320">
    <rect width="640" height="320" fill="${bg}"/>
    ${edgesSvg}
    ${ringsSvg}
    ${nodesSvg}
    <rect x="0" y="264" width="640" height="56" fill="${dark}" opacity="0.93"/>
    <text x="14" y="280" font-family="monospace" font-size="9" fill="${accent}" letter-spacing="0.05em">${xmlEsc(topic.toUpperCase())}</text>
    <text x="14" y="297" font-family="monospace" font-size="11" font-weight="bold" fill="#ffffff">${title}</text>
    <text x="14" y="312" font-family="monospace" font-size="8" fill="rgba(255,255,255,0.65)">${authorLine}</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function paperImageSrc(paper) {
  return getPaperDiagramDataUri(paper);
}

function paperImageAlt(paper) {
  return paperAltMap[paper.id] || `Architecture diagram for ${paper.title}`;
}

// ── PDF.js thumbnail rendering ─────────────────────────────────────────────
// Initialise the worker once PDF.js is available (loaded via <script> in head).
if (typeof pdfjsLib !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

const _thumbnailCache = new Map(); // paper.id → jpeg data URL
const _renderingSet   = new Set(); // paper.ids currently being fetched/rendered

// Derive a fetchable PDF URL from a paper's existing link field.
// Returns null when the link is an HTML page (blog posts, etc.).
function getPaperPdfUrl(paper) {
  // Local papers: link is the relative PDF path set by buildLocalPapers()
  if (paper.isLocal) return paper.link;

  const link = paper.link || "";

  // arXiv abstract page → direct PDF download
  if (link.includes("arxiv.org/abs/")) {
    return link.replace("arxiv.org/abs/", "arxiv.org/pdf/");
  }

  // Discovery papers whose link points at an arXiv page
  if (paper.isDiscovery && link.includes("arxiv.org")) {
    const m = link.match(/(\d{4}\.\d{4,5})/);
    if (m) return `https://arxiv.org/pdf/${m[1]}`;
  }

  // Already a direct PDF link (e.g. GPT-2 OpenAI PDF)
  if (/\.pdf(\?.*)?$/i.test(link)) return link;

  return null; // blog posts / HTML pages — keep SVG fallback
}

// Asynchronously render the first page of a paper's PDF into every
// img[data-paper-id] element currently in the DOM for that paper.
async function renderPdfThumbnail(paper) {
  if (!window.pdfjsLib) return;
  if (_renderingSet.has(paper.id)) return; // already in-flight

  // Serve instantly from cache if already rendered
  if (_thumbnailCache.has(paper.id)) {
    document
      .querySelectorAll(`img[data-paper-id="${CSS.escape(paper.id)}"]`)
      .forEach((el) => { el.src = _thumbnailCache.get(paper.id); });
    return;
  }

  const pdfUrl = getPaperPdfUrl(paper);
  if (!pdfUrl) return;

  _renderingSet.add(paper.id);
  try {
    const pdf  = await pdfjsLib.getDocument({ url: pdfUrl }).promise;
    const page = await pdf.getPage(1);

    // Render at 480 px wide — enough quality for card + detail use
    const baseViewport = page.getViewport({ scale: 1 });
    const scale        = 480 / baseViewport.width;
    const viewport     = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width  = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;

    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    _thumbnailCache.set(paper.id, dataUrl);

    // Update every matching img still in the DOM
    document
      .querySelectorAll(`img[data-paper-id="${CSS.escape(paper.id)}"]`)
      .forEach((el) => { el.src = dataUrl; });
  } catch (_err) {
    // Network / CORS / parse error — keep SVG placeholder silently
  } finally {
    _renderingSet.delete(paper.id);
  }
}

// Queue async PDF renders for every paper image found in `container`.
function schedulePdfRenders(container) {
  if (!window.pdfjsLib) return;
  container.querySelectorAll("img[data-paper-id]").forEach((imgEl) => {
    const paper = papers.find((p) => p.id === imgEl.dataset.paperId);
    if (paper) renderPdfThumbnail(paper);
  });
}

function filterPapers() {
  if (activeFilter === "all") return papers;
  return papers.filter((paper) => paper.groups.includes(activeFilter));
}

function renderDiscoveryFeed() {
  if (!discoveryFeedEl) return;

  discoveryFeedEl.innerHTML = "";
  if (discoveryCountEl) {
    discoveryCountEl.textContent = `${discoveredWebPapers.length} results`;
  }

  for (const paper of discoveredWebPapers) {
    const card = document.createElement("a");
    card.className = "paper-card";
    card.href = paper.link;
    card.target = "_blank";
    card.rel = "noopener noreferrer";
    card.setAttribute("aria-label", `Open source for ${paper.title}`);

    const [dkw1] = extractPaperKeywords(paper);
    card.innerHTML = `
      <img class="card-image" src="${kwPlaceholder(dkw1)}" alt="${dkw1}" data-wiki-article="${dkw1}" data-paper-id="${paper.id}" />
      <div class="card-body">
        <div class="card-tags">
          <span class="tag latest">Discovery</span>
        </div>
        <h3 class="card-title">${paper.title}</h3>
        <p class="card-preview">${paper.preview}</p>
        <div class="card-meta">${paper.authors} • ${paper.year}</div>
      </div>
    `;

    discoveryFeedEl.appendChild(card);
  }
  scheduleWikiSummaryImages(discoveryFeedEl);
  schedulePdfRenders(discoveryFeedEl);
}

function renderFeed() {
  const filtered = filterPapers();
  const visible = filtered;

  if (!visible.some((paper) => paper.id === selectedPaperId) && visible.length > 0) {
    selectedPaperId = visible[0].id;
  }

  feedEl.innerHTML = "";

  for (const paper of visible) {
    const card = document.createElement("button");
    card.className = `paper-card ${paper.id === selectedPaperId ? "is-selected" : ""}`;
    card.type = "button";
    card.role = "option";
    card.setAttribute("aria-selected", String(paper.id === selectedPaperId));
    card.setAttribute("aria-label", `Select ${paper.title}`);

    const [fkw1] = extractPaperKeywords(paper);
    card.innerHTML = `
      <img class="card-image" src="${kwPlaceholder(fkw1)}" alt="${fkw1}" data-wiki-article="${fkw1}" data-paper-id="${paper.id}" />
      <div class="card-body">
        <div class="card-tags">
          ${paper.groups
            .map((group) => `<span class="tag ${groupClass(group)}">${groupLabel(group)}</span>`)
            .join("")}
        </div>
        <h3 class="card-title">${paper.title}</h3>
        <p class="card-preview">${paper.preview}</p>
        <div class="card-meta">${paper.authors} • ${paper.year}</div>
      </div>
    `;

    card.addEventListener("click", () => {
      selectedPaperId = paper.id;
      renderFeed();
      renderDetail();
    });

    feedEl.appendChild(card);
  }

  feedCountEl.textContent = `${visible.length} papers`;
  scheduleWikiSummaryImages(feedEl);
  schedulePdfRenders(feedEl);
}

function renderDetail() {
  const paper = papers.find((item) => item.id === selectedPaperId);
  if (!paper) return;

  const [dkw1, dkw2, dkw3] = extractPaperKeywords(paper);
  detailEl.innerHTML = `
    <div class="summary-image-scroller" aria-label="Key topic images for ${paper.title}">
      <div class="keyword-image-pair">
        <figure class="keyword-figure">
          <img class="summary-kw-image" src="${kwPlaceholder(dkw1)}" alt="${dkw1}" data-wiki-article="${dkw1}" data-paper-id="${paper.id}" />
          <figcaption class="keyword-label">${dkw1}</figcaption>
        </figure>
        <figure class="keyword-figure">
          <img class="summary-kw-image" src="${kwPlaceholder(dkw2)}" alt="${dkw2}" data-wiki-article="${dkw2}" />
          <figcaption class="keyword-label">${dkw2}</figcaption>
        </figure>
        <figure class="keyword-figure">
          <img class="summary-kw-image" src="${kwPlaceholder(dkw3)}" alt="${dkw3}" data-wiki-article="${dkw3}" />
          <figcaption class="keyword-label">${dkw3}</figcaption>
        </figure>
      </div>
    </div>
    <h2>${paper.title}</h2>
    <p class="detail-meta">${paper.authors} • ${paper.year}</p>
    <p class="detail-meta">Groups: ${paper.groups.map(groupLabel).join(", ")}</p>

    <div class="detail-summary">
      <h3>Summary</h3>
      <p>${paper.summary}</p>
    </div>

    <div class="detail-matters">
      <h3>Why It Matters for Datacenters</h3>
      <p>${paper.datacenter}</p>
    </div>

    <div class="detail-metrics">
      <h3>Key Result Signal</h3>
      <p>${paper.metrics}</p>
    </div>

    <div class="detail-link-row">
      <a class="solid-link" href="#paper-${paper.id}">Jump to Full Section</a>
      <a class="ghost-link" href="${paper.link}" target="_blank" rel="noopener noreferrer">${linkLabel(paper)}</a>
    </div>

    <p class="detail-meta">Keyboard tip: focus a card and press <kbd>Enter</kbd> or <kbd>Space</kbd> to select.</p>
  `;
  scheduleWikiSummaryImages(detailEl);
  schedulePdfRenders(detailEl);
}

// ── Wikipedia keyword images — full paper summaries only ───────────────────────────
// Maps each curated paper.id → [wikiArticleTitle1, wikiArticleTitle2].
// Repeated article titles across papers share the same cached Wikipedia image.
const paperKeywords = {
  "attention-2017":      ["Transformer (deep learning)",    "Attention (machine learning)",  "Artificial neural network"],
  "bert-2018":           ["BERT (language model)",          "Transfer learning",             "Natural language processing"],
  "gpt2-2019":           ["GPT-2",                          "Language model",                "Natural language processing"],
  "gpt3-2020":           ["GPT-3",                          "Few-shot learning",             "Large language model"],
  "scaling-laws-2020":   ["Neural scaling law",             "Artificial neural network",     "Deep learning"],
  "megatron-lm-2019":    ["Model parallelism",              "Graphics processing unit",      "Distributed computing"],
  "zero-2020":           ["DeepSpeed",                      "Distributed computing",         "Graphics processing unit"],
  "gshard-2020":         ["Mixture of experts",             "Tensor processing unit",        "Distributed computing"],
  "switch-2021":         ["Mixture of experts",             "Sparse neural network",         "Transfer learning"],
  "palm-2022":           ["PaLM (language model)",          "Tensor processing unit",        "Large language model"],
  "flashattention-2022": ["Attention (machine learning)",   "High Bandwidth Memory",         "Graphics processing unit"],
  "llama-2023":          ["Llama (language model)",         "Open-source software",          "Large language model"],
  "vllm-2023":           ["Virtual memory",                 "Cache (computing)",             "Graphics processing unit"],
  "mistral-7b-2023":     ["Mistral AI",                     "Attention (machine learning)",  "Sliding window protocol"],
  "dbrx-2024":           ["Mixture of experts",             "Databricks",                    "Large language model"],
};

// Ordered term→article pairs for auto-detection in local / discovered papers.
// More specific patterns first — first three matches win.
const _termWikiArticle = [
  [/large language model|llms?\b/i,         "Large language model"],
  [/mixture.of.expert|moe\b/i,              "Mixture of experts"],
  [/transformer\b/i,                        "Transformer (deep learning)"],
  [/quantiz/i,                              "Quantization (signal processing)"],
  [/attention mechanism/i,                  "Attention (machine learning)"],
  [/deep.?seek/i,                           "DeepSeek"],
  [/\bllama\b/i,                            "Llama (language model)"],
  [/mistral/i,                              "Mistral AI"],
  [/agentic|\bagent\b/i,                    "Intelligent agent"],
  [/photonic|optical interconnect/i,        "Photonics"],
  [/dataflow/i,                             "Dataflow architecture"],
  [/kv.cache|key.value cache/i,             "Cache (computing)"],
  [/benchmark/i,                            "Benchmark (computing)"],
  [/\bgpu\b|graphics processing/i,          "Graphics processing unit"],
  [/\btpu\b|tensor processing/i,            "Tensor processing unit"],
  [/floating.point|fp8|fp4|nvfp/i,          "Floating-point arithmetic"],
  [/\bgemm\b|matrix mult/i,                 "Matrix multiplication"],
  [/\bcuda\b/i,                             "CUDA"],
  [/fine.tun/i,                             "Fine-tuning (deep learning)"],
  [/survey\b/i,                             "Academic publishing"],
  [/sparse/i,                               "Sparse matrix"],
  [/\bmemory\b/i,                           "Computer memory"],
  [/interconnect/i,                         "Network on a chip"],
  [/\binference\b/i,                        "Machine learning"],
  [/neural network|deep learning/i,         "Artificial neural network"],
];

// Returns [wikiArticle1, wikiArticle2, wikiArticle3] for any paper.
function extractPaperKeywords(paper) {
  if (paperKeywords[paper.id]) return paperKeywords[paper.id];
  const corpus = `${paper.title} ${paper.preview || ""} ${paper.summary || ""}`;
  const found = [];
  for (const [re, article] of _termWikiArticle) {
    if (re.test(corpus) && !found.includes(article)) {
      found.push(article);
      if (found.length === 3) break;
    }
  }
  if (found.length < 1) found.push("Large language model");
  if (found.length < 2) found.push("Artificial neural network");
  if (found.length < 3) found.push("Deep learning");
  return found;
}

// Shared cache: article title → thumbnail URL | null.
// _wikiPromiseMap deduplicates concurrent fetches for the same article.
const _wikiImgCache   = new Map();
const _wikiPromiseMap = new Map();

// Local keyword images folder — filenames match Wikipedia article titles exactly.
const _localImgBase = "Key Word Images/";

function fetchWikiThumb(article) {
  if (_wikiImgCache.has(article))   return Promise.resolve(_wikiImgCache.get(article));
  if (_wikiPromiseMap.has(article)) return _wikiPromiseMap.get(article);

  const p = fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(article)}`,
    { headers: { Accept: "application/json" } }
  )
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const url = d?.originalimage?.source || d?.thumbnail?.source || null;
      _wikiImgCache.set(article, url);
      return url;
    })
    .catch(() => { _wikiImgCache.set(article, null); return null; });

  _wikiPromiseMap.set(article, p);
  return p;
}

// Resolves a local image path for an article if the file exists in "Key Word Images/".
// Returns a Promise<string|null> — the path if loadable, null otherwise.
function probeLocalImage(article) {
  return new Promise((resolve) => {
    const img = new Image();
    const path = _localImgBase + article + ".png";
    img.onload  = () => resolve(path);
    img.onerror = () => resolve(null);
    img.src = path;
  });
}

// Fetches Wikipedia thumbnails and updates all img[data-wiki-article] in container.
// Falls back to Key Word Images/<article>.png, then to the SVG keyword placeholder.
function scheduleWikiSummaryImages(container) {
  container.querySelectorAll("img[data-wiki-article]").forEach((img) => {
    const article = img.dataset.wikiArticle;
    if (!article) return;
    fetchWikiThumb(article).then((url) => {
      if (url && img.isConnected) { img.src = url; return; }
      // Wikipedia returned nothing — try local keyword image folder.
      probeLocalImage(article).then((localPath) => {
        if (localPath && img.isConnected) img.src = localPath;
        // If neither found, the kwPlaceholder SVG set at render time stays.
      });
    });
  });
}



// Inline SVG placeholder shown while (or instead of) a Wikipedia image.
// Designed to look reasonable as a permanent fallback, not just a transient spinner.
function kwPlaceholder(kw) {
  const safe = kw.replace(/&/g, "&amp;").replace(/</g, "&lt;").slice(0, 36);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><rect width="300" height="200" fill="#eef2f8" rx="4"/><rect x="20" y="20" width="260" height="160" fill="none" stroke="#c8d8d2" stroke-width="1" rx="3"/><text x="150" y="96" text-anchor="middle" font-family="monospace" font-size="11" fill="#4a5d66" dominant-baseline="middle">${safe}</text></svg>`
  )}`;
}

function renderFullSections() {
  sectionEl.innerHTML = papers
    .map((paper) => {
      const [kw1, kw2, kw3] = extractPaperKeywords(paper);
      return `
      <article class="paper-section" id="paper-${paper.id}">
        <h3>${paper.title}</h3>
        <div class="summary-image-scroller" aria-label="Key topic images for ${paper.title}">
          <div class="keyword-image-pair">
            <figure class="keyword-figure">
              <img class="summary-kw-image" src="${kwPlaceholder(kw1)}" alt="${kw1}" data-wiki-article="${kw1}" />
              <figcaption class="keyword-label">${kw1}</figcaption>
            </figure>
            <figure class="keyword-figure">
              <img class="summary-kw-image" src="${kwPlaceholder(kw2)}" alt="${kw2}" data-wiki-article="${kw2}" />
              <figcaption class="keyword-label">${kw2}</figcaption>
            </figure>
            <figure class="keyword-figure">
              <img class="summary-kw-image" src="${kwPlaceholder(kw3)}" alt="${kw3}" data-wiki-article="${kw3}" />
              <figcaption class="keyword-label">${kw3}</figcaption>
            </figure>
          </div>
        </div>
        <p><strong>Authors:</strong> ${paper.authors}</p>
        <p><strong>Year:</strong> ${paper.year}</p>
        <p><strong>Category:</strong> ${paper.groups.map(groupLabel).join(", ")}</p>
        <p><strong>Summary:</strong> ${paper.summary}</p>
        <p><strong>Datacenter Significance:</strong> ${paper.datacenter}</p>
        <p><strong>Key Result Signal:</strong> ${paper.metrics}</p>
        <p><a href="${paper.link}" target="_blank" rel="noopener noreferrer">${linkLabel(paper)}</a></p>
      </article>
      `;
    })
    .join("");
  scheduleWikiSummaryImages(sectionEl);
}

function bindSummarySearch() {
  const input = document.getElementById("summarySearch");
  const countEl = document.getElementById("summarySearchCount");
  if (!input) return;

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function applySearch() {
    const raw = input.value.trim();
    const sections = document.querySelectorAll("#fullSections .paper-section");
    let visible = 0;

    if (!raw) {
      sections.forEach((el) => el.classList.remove("summary-section--hidden"));
      // Remove any existing highlights
      sections.forEach((el) => {
        el.querySelectorAll(".summary-search-highlight").forEach((mark) => {
          mark.replaceWith(mark.textContent);
        });
      });
      countEl.textContent = "";
      return;
    }

    const re = new RegExp(escapeRe(raw), "gi");

    sections.forEach((el) => {
      // Remove old highlights first
      el.querySelectorAll(".summary-search-highlight").forEach((mark) => {
        mark.replaceWith(mark.textContent);
      });

      const text = el.innerText || el.textContent;
      if (re.test(text)) {
        el.classList.remove("summary-section--hidden");
        visible++;
        // Highlight matches inside text nodes only (safe, no innerHTML injection)
        highlightTextNodes(el, new RegExp(escapeRe(raw), "gi"));
      } else {
        el.classList.add("summary-section--hidden");
      }
    });

    countEl.textContent = visible === 0 ? "No matches" : `${visible} match${visible === 1 ? "" : "es"}`;
  }

  function highlightTextNodes(root, re) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodesToProcess = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue.trim() && re.test(node.nodeValue)) {
        nodesToProcess.push(node);
      }
      re.lastIndex = 0;
    }
    nodesToProcess.forEach((textNode) => {
      const frag = document.createDocumentFragment();
      let last = 0;
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(textNode.nodeValue)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(textNode.nodeValue.slice(last, m.index)));
        const mark = document.createElement("mark");
        mark.className = "summary-search-highlight";
        mark.textContent = m[0];
        frag.appendChild(mark);
        last = m.index + m[0].length;
      }
      if (last < textNode.nodeValue.length) frag.appendChild(document.createTextNode(textNode.nodeValue.slice(last)));
      textNode.parentNode.replaceChild(frag, textNode);
    });
  }

  input.addEventListener("input", applySearch);

  // Clear search when pressing Escape
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      applySearch();
      input.blur();
    }
  });
}

function bindFilters() {
  for (const btn of filterButtons) {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter || "all";
      filterButtons.forEach((node) => node.classList.remove("is-active"));
      btn.classList.add("is-active");
      renderFeed();
      renderDetail();
    });
  }
}

function init() {
  rebuildPapers();

  if (discoveryQueryEl) {
    discoveryQueryEl.textContent = `Results from: "${discoveryQuery}"`;
  }

  if (findNewPapersBtn) {
    findNewPapersBtn.addEventListener("click", handleFindNewPapers);
  }

  renderDiscoveryFeed();
  bindFilters();
  bindSummarySearch();
  renderFeed();
  renderDetail();
  renderFullSections();

  // Load local papers from papers-manifest.js (populated by watch-papers.py)
  refreshLocalPapersFromManifest();

  // When served over HTTP, poll papers-manifest.json every 8 s for new PDFs
  // without needing a full page reload (supplements the SSE reload signal).
  if (location.hostname) {
    setInterval(pollManifestJson, 8000);
  }
}

// Fetches papers-manifest.json and merges any newly discovered PDFs into the feed.
let _lastManifestUpdated = "";
async function pollManifestJson() {
  try {
    const res = await fetch(`papers-manifest.json?_=${Date.now()}`);
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data.files) || data.updated === _lastManifestUpdated) return;
    _lastManifestUpdated = data.updated;
    // Store sidecar metadata so buildLocalPapers() can merge it.
    if (data.metadata && typeof data.metadata === "object") {
      _manifestMetadata = data.metadata;
    }
    // Sync window.localPapersManifest so refreshLocalPapersFromManifest works correctly
    window.localPapersManifest = data.files;
    refreshLocalPapersFromManifest();
  } catch (_) {
    // Network error or server not running — silently ignore
  }
}

init();
