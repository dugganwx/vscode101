# AI Architecture Papers Portal - UX/Product Specification (Static MVP)

**Group Name:** Systems Architecture and Innovation

## 1. Product Vision
Create a high-signal, technically rigorous website that serves as a repository and summarization portal for the most valuable AI architecture papers for datacenter experts.

The portal should help users quickly answer:
- What papers matter most right now?
- What papers are most read by practitioners?
- What is newest and worth immediate attention?
- For any paper, what are the practical datacenter implications?

This first version is static (no backend), but designed to transition cleanly to a dynamic data-driven implementation.

## 2. Primary Audience
- Datacenter architects
- AI infrastructure engineers
- ML platform engineers
- HPC and systems performance engineers
- Technical leaders evaluating AI stack roadmap decisions

## 3. Core UX Goals
- Fast scanning: users should understand value in less than 60 seconds.
- Trust and depth: summaries must be technically accurate and implementation-oriented.
- Frictionless discovery: scrollable news-feed style previews that are visually engaging and selectable.
- Decision support: each paper page/section includes why it matters for compute, memory, networking, and serving.

## 4. Content Model and Groupings
Each paper can be tagged under one or more primary groups:

1. Most Important
2. Most Read
3. Latest

Each paper entry should include:
- Title
- Authors / Organization
- Year
- Primary tags (training scaling, MoE, inference serving, interconnect, memory optimization, etc.)
- Read time (for summary)
- Hero image thumbnail
- 3-line preview (for feed card)
- Full summary section
- Datacenter impact
- Link to original paper

## 5. Information Architecture
## 5.1 Main Navigation
- Home
- Most Important
- Most Read
- Latest
- All Papers
- About / Methodology

## 5.2 Home Layout (Main Window)
1. Hero header
   - Value proposition: "The technical paper desk for AI datacenter architecture"
   - Quick filter chips: Important, Read, Latest, Training, Inference, Networking, Memory

2. Scrollable "News Feed" Panel (core requirement)
   - Vertical, scrollable card list
   - Each card is selectable (click/tap opens detailed section)
   - Each card includes a compelling image (diagram/photo/abstract visual)
   - Sticky sort control: Most Important | Most Read | Latest

3. Featured technical insights strip
   - 3 concise callouts: "Bandwidth bottleneck", "MoE routing efficiency", "Inference memory pressure"

4. Paper detail area
   - Inline detail panel on same page for static MVP
   - Optional anchor navigation to full section further down

## 6. Key Interaction Requirements
- The news feed must remain scrollable independently from page content on desktop.
- Cards are keyboard accessible and selectable via Enter/Space.
- Selection state is visually clear (border, shadow, and section highlight).
- Selected card updates detail panel with:
  - Summary
  - Why it matters for datacenters
  - Key metrics/results from paper
  - Link to full paper
- On mobile, feed appears first, then detail section below.

## 7. Visual/UX Direction
- Tone: premium technical briefing, not generic blog.
- Imagery: one interesting image per paper card (architecture diagram crop, system topology, compute rack photo, synthetic technical art).
- Typography: readable technical serif/sans pairing for authority and scanability.
- Card hierarchy:
  - Top: image
  - Middle: group badges and title
  - Bottom: 2-3 line summary preview and metadata
- Color language:
  - Important = deep red accent
  - Most Read = cobalt accent
  - Latest = emerald accent

## 8. Accessibility and Usability
- WCAG AA contrast minimum.
- All images must have meaningful alt text.
- Keyboard-only full navigation.
- Focus states visible for feed cards and controls.
- Avoid motion-heavy effects; keep transitions subtle and purposeful.

## 9. Static MVP Technical Notes
- Static JSON-like structure can be represented directly in HTML as cards and sections.
- Each card references a local image path (for now placeholder assets).
- Use anchor links (`#paper-...`) to jump to paper sections.
- Later dynamic migration path:
  - Card data from API/CMS
  - Popularity metrics from analytics pipeline
  - Latest sorting from publication timestamp

## 10. Seed Paper List (Static Initial Set)
The list below covers foundational and high-impact architecture/system papers relevant to datacenter experts.

---

## Paper Section 1: Attention Is All You Need
- Group: Most Important
- Year: 2017
- Authors: Vaswani et al.
- Suggested card image: Transformer block diagram (attention stack visualization)
- Summary:
  - Introduced the Transformer architecture, replacing recurrence with self-attention.
  - Enabled efficient parallelization during training compared with RNN-based models.
  - Became the architectural base for modern LLMs and many multimodal systems.
- Datacenter significance:
  - Shifted workload characteristics toward dense matrix operations with high memory bandwidth demands.
  - Established the scaling path that drove large GPU clusters and interconnect-heavy training infrastructure.
- Link: https://arxiv.org/abs/1706.03762

## Paper Section 2: BERT: Pre-training of Deep Bidirectional Transformers
- Group: Most Important, Most Read
- Year: 2018
- Authors: Devlin et al.
- Suggested card image: Encoder-only stack illustration with masked token examples
- Summary:
  - Demonstrated bidirectional pretraining and transfer learning gains in NLP tasks.
  - Validated large-scale pretraining + fine-tuning as a dominant paradigm.
  - Accelerated enterprise NLP adoption and production inference at scale.
- Datacenter significance:
  - Sparked widespread inference deployment needs and cost-sensitive serving optimization.
  - Increased focus on batching, quantization, and latency-throughput tradeoffs.
- Link: https://arxiv.org/abs/1810.04805

## Paper Section 3: Language Models are Unsupervised Multitask Learners (GPT-2)
- Group: Most Important
- Year: 2019
- Authors: Radford et al.
- Suggested card image: Decoder-only model diagram with scaling axis
- Summary:
  - Showed strong zero-shot task performance from generative pretraining.
  - Reinforced the value of decoder-only scaling for broad capability emergence.
  - Influenced the architecture trajectory toward larger autoregressive models.
- Datacenter significance:
  - Increased demand for high-throughput autoregressive inference with strict latency constraints.
  - Highlighted memory footprint and token generation efficiency as operational bottlenecks.
- Link: https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf

## Paper Section 4: Language Models are Few-Shot Learners (GPT-3)
- Group: Most Important, Most Read
- Year: 2020
- Authors: Brown et al.
- Suggested card image: Parameter scaling chart and few-shot prompt concept visual
- Summary:
  - Demonstrated strong few-shot performance at 175B parameters.
  - Cemented scaling laws in practical model development strategy.
  - Made prompt-based usage mainstream across applications.
- Datacenter significance:
  - Exposed extreme training cost and cluster scheduling complexity.
  - Elevated focus on model-parallel training, optimizer partitioning, and checkpoint strategy.
- Link: https://arxiv.org/abs/2005.14165

## Paper Section 5: Scaling Laws for Neural Language Models
- Group: Most Important
- Year: 2020
- Authors: Kaplan et al.
- Suggested card image: Loss vs scale curves for model/data/compute
- Summary:
  - Quantified power-law relationships between compute, model size, data, and loss.
  - Provided planning heuristics for compute-efficient training programs.
  - Influenced budget allocation and capacity forecasting in AI infrastructure.
- Datacenter significance:
  - Supports capex/opex planning for cluster build-outs.
  - Informs tradeoffs among compute cycles, dataset expansion, and model parameter growth.
- Link: https://arxiv.org/abs/2001.08361

## Paper Section 6: Megatron-LM: Training Multi-Billion Parameter Language Models
- Group: Most Important, Most Read
- Year: 2019
- Authors: Shoeybi et al.
- Suggested card image: Tensor/pipeline parallelism partition diagram
- Summary:
  - Introduced practical large-model parallelism strategies for training at scale.
  - Demonstrated model/tensor parallel methods on large GPU clusters.
  - Became foundational for modern distributed LLM training stacks.
- Datacenter significance:
  - Highlights communication overhead and network topology constraints.
  - Directly relevant to NVLink/NVSwitch/InfiniBand utilization and scaling efficiency.
- Link: https://arxiv.org/abs/1909.08053

## Paper Section 7: ZeRO: Memory Optimizations Toward Training Trillion Parameter Models
- Group: Most Important, Most Read
- Year: 2020
- Authors: Rajbhandari et al.
- Suggested card image: Optimizer/gradient/state sharding conceptual chart
- Summary:
  - Proposed optimizer state, gradient, and parameter partitioning for memory reduction.
  - Enabled much larger training jobs without linear memory duplication.
  - Widely adopted through DeepSpeed and related distributed frameworks.
- Datacenter significance:
  - Improves hardware utilization and effective model capacity per cluster.
  - Reduces memory bottlenecks and shifts performance focus to communication patterns.
- Link: https://arxiv.org/abs/1910.02054

## Paper Section 8: GShard: Scaling Giant Models with Conditional Computation and Automatic Sharding
- Group: Most Important
- Year: 2020
- Authors: Lepikhin et al.
- Suggested card image: MoE routing and expert dispatch diagram
- Summary:
  - Presented sparse MoE scaling with automatic sharding for very large parameter counts.
  - Reduced per-token compute while increasing representational capacity.
  - Established design patterns for expert routing at distributed scale.
- Datacenter significance:
  - Introduces network-sensitive all-to-all communication behavior.
  - Makes interconnect design and congestion control key to achieving theoretical efficiency.
- Link: https://arxiv.org/abs/2006.16668

## Paper Section 9: Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity
- Group: Most Important, Most Read
- Year: 2021
- Authors: Fedus et al.
- Suggested card image: Top-1 routing expert switch diagram
- Summary:
  - Simplified MoE routing to improve training stability and scalability.
  - Showed sparse architectures can reach trillion-parameter regime efficiently.
  - Increased practical interest in sparse-dense hybrid infrastructure.
- Datacenter significance:
  - Emphasizes balancing expert load and minimizing communication hot spots.
  - Drives requirements for high-bandwidth, low-latency fabric under irregular traffic.
- Link: https://arxiv.org/abs/2101.03961

## Paper Section 10: PaLM: Scaling Language Modeling with Pathways
- Group: Most Important, Most Read
- Year: 2022
- Authors: Chowdhery et al.
- Suggested card image: TPU pod scale and pathways system illustration
- Summary:
  - Demonstrated strong performance from very large-scale dense language model training.
  - Combined large compute budgets with robust data/architecture strategy.
  - Influenced production-level foundation model training programs.
- Datacenter significance:
  - Highlights orchestration, checkpoint resilience, and long-run training reliability.
  - Reinforces need for mature scheduling and fault-tolerant distributed execution.
- Link: https://arxiv.org/abs/2204.02311

## Paper Section 11: FlashAttention: Fast and Memory-Efficient Exact Attention
- Group: Most Important, Most Read
- Year: 2022
- Authors: Dao et al.
- Suggested card image: Tiled attention kernel/memory access visualization
- Summary:
  - Introduced IO-aware attention algorithm reducing HBM accesses.
  - Achieved major speed and memory improvements without approximation.
  - Became a key kernel-level optimization in training and inference stacks.
- Datacenter significance:
  - Shows software-kernel innovation can defer expensive hardware scaling.
  - Improves throughput per accelerator and cluster-wide efficiency.
- Link: https://arxiv.org/abs/2205.14135

## Paper Section 12: LLaMA: Open and Efficient Foundation Language Models
- Group: Most Read
- Year: 2023
- Authors: Touvron et al.
- Suggested card image: Parameter-size family comparison chart
- Summary:
  - Released strong open model family with favorable performance-to-size profile.
  - Enabled broader experimentation across academia and enterprise.
  - Accelerated ecosystem tooling and fine-tuning practices.
- Datacenter significance:
  - Expanded demand for cost-efficient inference and fine-tuning infrastructure.
  - Increased interest in mixed precision, quantization, and serving density optimization.
- Link: https://arxiv.org/abs/2302.13971

## Paper Section 13: Efficient Memory Management for Large Language Model Serving with PagedAttention (vLLM)
- Group: Most Important, Latest
- Year: 2023
- Authors: Kwon et al.
- Suggested card image: KV-cache paging and memory block allocator diagram
- Summary:
  - Proposed PagedAttention to improve KV cache utilization during serving.
  - Significantly improved throughput and reduced memory fragmentation.
  - Helped establish modern high-efficiency LLM serving design.
- Datacenter significance:
  - Direct impact on GPU memory utilization and tokens/sec per dollar.
  - Critical for multi-tenant serving economics in production environments.
- Link: https://arxiv.org/abs/2309.06180

## Paper Section 14: Mistral 7B (and follow-on efficient open models)
- Group: Latest, Most Read
- Year: 2023
- Authors: Jiang et al.
- Suggested card image: Sliding-window attention concept visual
- Summary:
  - Highlighted efficient architecture and training choices for strong small-model performance.
  - Popularized quality/cost optimization in open model development.
  - Contributed to practical deployment choices beyond largest-parameter models.
- Datacenter significance:
  - Supports right-sizing strategy for workload classes.
  - Improves fleet efficiency by matching model size to SLA and cost envelopes.
- Link: https://arxiv.org/abs/2310.06825

## Paper Section 15: DBRX Technical Report
- Group: Latest
- Year: 2024
- Authors: Databricks
- Suggested card image: MoE architecture and training/serving stack chart
- Summary:
  - Describes a modern open MoE foundation model and production-oriented pipeline.
  - Emphasizes practical system tradeoffs in training and inference for enterprise usage.
  - Adds evidence for sparse model viability in real workloads.
- Datacenter significance:
  - Relevant to MoE serving architecture and cluster scheduling under mixed loads.
  - Highlights memory bandwidth and network contention tradeoffs in sparse inference.
- Link: https://www.databricks.com/blog/introducing-dbrx-new-state-art-open-llm

---

## 11. Home Feed Card Spec (Static)
Each feed item should use this content structure:

- `id`: unique slug (example: `paper-flashattention`)
- `group`: Important | Most Read | Latest (one or more)
- `title`
- `year`
- `authors`
- `image`
- `imageAlt`
- `preview`
- `summaryAnchor` (example: `#paper-flashattention`)
- `whyItMatters`

### Example Card Copy
Title: FlashAttention: Fast and Memory-Efficient Exact Attention  
Preview: A kernel-level breakthrough that lowers memory movement in attention and dramatically improves throughput without approximation.  
Why it matters: Increases accelerator efficiency and reduces cluster-level compute cost.

## 12. Editorial Methodology
- Prioritize papers with strong empirical results and reproducible systems implications.
- Balance foundational classics with current deployment-relevant publications.
- For "Most Read," use proxy metrics initially (citations/community traction), then replace with site analytics in dynamic phase.
- For "Latest," maintain a recency window (e.g., last 18 months).

## 13. MVP Acceptance Criteria
- Static homepage contains a scrollable news feed with selectable cards.
- Each card has an image and links to a full paper summary section.
- Paper sections include summary + datacenter significance.
- User can filter by Most Important, Most Read, and Latest.
- Layout is usable on desktop and mobile.
- All links and anchor targets function in static hosting.

## 14. Next Step After This Document
Use this specification to implement a static HTML/CSS/JS prototype in `WebProject1` with:
- `index.html`
- `styles.css`
- `app.js`
- `assets/images/*` (placeholder images initially)
