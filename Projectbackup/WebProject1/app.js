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
  }
];

const localPaperFolder = "AI papers for WebProject1";
const localPaperFiles = [
  "1.Krste .pdf",
  "20. AMD_Matrix_Cores.pdf",
  "2025-10-device-based-optical-thermodynamics-route.pdf",
  "A GEMM-oriented emulation of floating-point matrix multipication using an integer modular technique.pdf",
  "A Survey of Low-bit Large Language Models Basics, Systems, and Algorithms.pdf",
  "A Survey on Efficient Inference for Large Language Models.pdf",
  "A Survey on Large Language Model Acceleration based on KV Cache Management.pdf",
  "Accumulator-Aware Post-Training Quantization for Large Language Models.pdf",
  "Advancing AI System Design with 3D Photonic Interconnects_OCP_Thomas_Graham_Lightmatter.pdf",
  "Agentic AI Optimization-AAIO.pdf",
  "AMD - idc- agentic white-paper.pdf",
  "amd-instinct-mi300-cdna3-instruction-set-architecture.pdf",
  "Benchmarking GPU Tensor Cores on General Matrix Multiplication Kernels through CUTLASS.pdf",
  "CUDA_Binary_Utilities.pdf",
  "Datacenter TCO for LLM Inference with FP8.pdf",
  "Dataflow-Near memory compute architectures for AI Acceleration.pdf",
  "DeepSeek-V3 Technical Report.pdf",
  "DeepSeek_V3_2-Exp Booosting Long-Context Efficiency with DeepSeek Sparse Attention.pdf",
  "DeepSpeed-FastGen High-throughput Text Generation for LLMs via MII and DeepSpeed-Inference.pdf",
  "Efficient and Scaleable Agentic AI with Heterogeneous.pdf",
  "Energy Use of AI Inference Efficiency Pathways and Test-Time Compute.pdf"
];

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
    const year = inferYear(fileName);
    const title = toDisplayTitle(fileName);
    const groups = inferGroups(fileName, year);
    const relativePath = `${localPaperFolder}/${fileName}`;

    return {
      id: `local-${slugify(fileName)}`,
      title,
      authors: "Repository Paper",
      year,
      groups,
      preview: "Local repository entry loaded from your WebProject1 paper folder.",
      summary:
        "This entry is pulled from the local paper repository. Add a custom hand-written summary here as you review the paper in detail.",
      datacenter:
        "Potentially relevant to accelerator efficiency, cluster architecture, inference economics, or system-level AI deployment tradeoffs.",
      metrics:
        "Key result signal not yet extracted. Review and annotate this item for production use.",
      link: encodeURI(relativePath),
      isLocal: true
    };
  });
}

const staticRepositoryPapers = [...curatedPapers, ...buildLocalPapers(localPaperFiles)];

let papers = [...discoveredWebPapers, ...staticRepositoryPapers];

const paperImageMap = {
  "attention-2017": {
    src: "https://picsum.photos/seed/transformer-architecture/960/540",
    alt: "High-level visual representing transformer architecture"
  },
  "bert-2018": {
    src: "https://picsum.photos/seed/bert-encoder/960/540",
    alt: "Visual representing encoder stack and masked token modeling"
  },
  "gpt2-2019": {
    src: "https://picsum.photos/seed/gpt2-decoder/960/540",
    alt: "Visual representing decoder-only language modeling"
  },
  "gpt3-2020": {
    src: "https://picsum.photos/seed/gpt3-scaling/960/540",
    alt: "Visual representing large-scale model growth and prompt-based use"
  },
  "scaling-laws-2020": {
    src: "https://picsum.photos/seed/scaling-laws-plot/960/540",
    alt: "Visual representing scaling relationships among compute, model size, and data"
  },
  "megatron-lm-2019": {
    src: "https://picsum.photos/seed/distributed-training/960/540",
    alt: "Visual representing distributed multi-GPU training topology"
  },
  "zero-2020": {
    src: "https://picsum.photos/seed/memory-sharding/960/540",
    alt: "Visual representing memory sharding and distributed optimizer state"
  },
  "gshard-2020": {
    src: "https://picsum.photos/seed/moe-routing/960/540",
    alt: "Visual representing sparse expert routing for MoE systems"
  },
  "switch-2021": {
    src: "https://picsum.photos/seed/switch-transformer/960/540",
    alt: "Visual representing sparse switch routing and expert balancing"
  },
  "palm-2022": {
    src: "https://picsum.photos/seed/palm-cluster/960/540",
    alt: "Visual representing pod-scale large model training infrastructure"
  },
  "flashattention-2022": {
    src: "https://picsum.photos/seed/flashattention-kernel/960/540",
    alt: "Visual representing memory-efficient attention kernel execution"
  },
  "llama-2023": {
    src: "https://picsum.photos/seed/open-models/960/540",
    alt: "Visual representing efficient open foundation model deployment"
  },
  "vllm-2023": {
    src: "https://picsum.photos/seed/kv-cache-serving/960/540",
    alt: "Visual representing KV-cache paging for LLM serving"
  },
  "mistral-7b-2023": {
    src: "https://picsum.photos/seed/efficient-small-model/960/540",
    alt: "Visual representing efficient small-model architecture and serving"
  },
  "dbrx-2024": {
    src: "https://picsum.photos/seed/dbrx-moe/960/540",
    alt: "Visual representing modern enterprise MoE training and inference stack"
  }
};

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
  papers = [...discoveredWebPapers, ...staticRepositoryPapers];

  if (!papers.some((item) => item.id === selectedPaperId) && papers.length > 0) {
    selectedPaperId = papers[0].id;
  }
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

// Uses OpenAlex API — supports CORS natively from any origin including file://
async function fetchDiscoveredPapers() {
  const cleanQuery = "LLM transformer architecture mixture of experts attention dataflow";
  const apiUrl = `https://api.openalex.org/works?search=${encodeURIComponent(
    cleanQuery
  )}&sort=cited_by_count:desc&per-page=6`;

  const response = await fetch(apiUrl, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`OpenAlex API ${response.status}`);
  const payload = await response.json();
  const rows = Array.isArray(payload.results) ? payload.results : [];
  return rows.map((entry, index) => toDiscoveryPaperFromOpenAlex(entry, index));
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

function paperImageDataUri(paper) {
  const tones = {
    important: ["#8f2e2e", "#d6b59b"],
    read: ["#235f9f", "#8eb3d9"],
    latest: ["#1f6b54", "#99ccb8"],
    all: ["#344c63", "#c0d2e0"]
  };

  const lead = paper.groups[0] || "all";
  const [c1, c2] = tones[lead] || tones.all;
  const label = `${paper.year} | ${paper.title.slice(0, 26)}`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='320' viewBox='0 0 640 320'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='${c1}'/>
        <stop offset='100%' stop-color='${c2}'/>
      </linearGradient>
    </defs>
    <rect width='640' height='320' fill='url(#g)'/>
    <circle cx='80' cy='70' r='56' fill='rgba(255,255,255,0.16)'/>
    <circle cx='560' cy='250' r='88' fill='rgba(10,20,26,0.16)'/>
    <path d='M34 260 C154 160, 262 278, 392 192 C460 148, 530 176, 612 130' stroke='rgba(255,255,255,0.65)' stroke-width='4' fill='none'/>
    <text x='28' y='294' font-size='22' font-family='Verdana' fill='#ffffff'>${label.replace(/&/g, "and")}</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function paperImageSrc(paper) {
  const mapped = paperImageMap[paper.id];
  if (mapped && mapped.src) {
    return mapped.src;
  }

  const photoSeed = encodeURIComponent(`paper-${paper.id}-${paper.year}`);
  return `https://picsum.photos/seed/${photoSeed}/960/540`;
}

function paperImageAlt(paper) {
  const mapped = paperImageMap[paper.id];
  if (mapped && mapped.alt) {
    return mapped.alt;
  }

  return `Visual abstract for ${paper.title}`;
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

    card.innerHTML = `
      <img class="card-image" src="${paperImageSrc(paper)}" alt="${paperImageAlt(paper)}" />
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

    card.innerHTML = `
      <img class="card-image" src="${paperImageSrc(paper)}" alt="${paperImageAlt(paper)}" />
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
}

function renderDetail() {
  const paper = papers.find((item) => item.id === selectedPaperId);
  if (!paper) return;

  detailEl.innerHTML = `
    <img class="detail-image" src="${paperImageSrc(paper)}" alt="${paperImageAlt(paper)}" />
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
}

function renderFullSections() {
  sectionEl.innerHTML = papers
    .map(
      (paper) => `
      <article class="paper-section" id="paper-${paper.id}">
        <h3>${paper.title}</h3>
        <div class="summary-image-scroller" aria-label="Key figure preview for ${paper.title}">
          <img
            class="summary-image"
            src="${paperImageSrc(paper)}"
            alt="${paperImageAlt(paper)}"
          />
        </div>
        <p><strong>Authors:</strong> ${paper.authors}</p>
        <p><strong>Year:</strong> ${paper.year}</p>
        <p><strong>Category:</strong> ${paper.groups.map(groupLabel).join(", ")}</p>
        <p><strong>Summary:</strong> ${paper.summary}</p>
        <p><strong>Datacenter Significance:</strong> ${paper.datacenter}</p>
        <p><strong>Key Result Signal:</strong> ${paper.metrics}</p>
        <p><a href="${paper.link}" target="_blank" rel="noopener noreferrer">${linkLabel(paper)}</a></p>
      </article>
      `
    )
    .join("");
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
  renderFeed();
  renderDetail();
  renderFullSections();
}

init();
