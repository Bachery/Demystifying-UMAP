# Demystifying-UMAP

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-000000?style=flat-square&logo=vercel)](https://interactive-umap-diagnostics.vercel.app/)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-2.x-FF3E00?style=flat-square&logo=svelte&logoColor=white)](https://kit.svelte.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-3D-000000?style=flat-square&logo=three.js&logoColor=white)](https://threejs.org/)
[![UMAP-JS](https://img.shields.io/badge/umap--js-Interactive%20Embedding-111827?style=flat-square)](https://github.com/PAIR-code/umap-js)
[![Paper](https://img.shields.io/badge/Paper-Information%20Visualization-0F766E?style=flat-square)](https://doi.org/10.1177/14738716261434908)

An interactive web application for diagnosing, understanding, and steering UMAP through synthetic 3D probe datasets.

**Live demo:** https://interactive-umap-diagnostics.vercel.app/

## Overview

`Demystifying-UMAP` is an interactive educational tool built to make UMAP artifacts visible instead of treating the embedding as a trustworthy map by default. The project links a 3D ground-truth view with a 2D UMAP view, allowing users to inspect where spatial logic breaks, where topology is lost, and where metric relationships become misleading.

The system was developed as a research instrument for studying the "cartographic fallacy" in dimensionality reduction: the tendency to read a 2D embedding as if it were a faithful map of the original geometry. By combining probe datasets, parameter tuning, initialization control, and direct manipulation, the application turns UMAP into something users can inspect and question.

## Highlights

- **10 synthetic 3D probe datasets** designed to expose distinct UMAP failure modes.
- Synchronized 3D ground truth and 2D UMAP views for direct visual comparison.
- Real-time experimentation with `n_neighbors`, `min_dist`, `spread`, and optimization epochs.
- Multiple initialization modes: `random`, `pca`, `spectral`, and `current`.
- **Human-in-the-loop steering**: drag selected clusters in 2D and re-run UMAP with injected priors.
- Projection history, morphing, and unstable-point highlighting for diagnosis and comparison.
- Browser-based implementation powered by `umap-js`, with computation offloaded to a Web Worker.

## What You Can Explore

- **Spatial logic failures:** cases where symmetric or semantically related structures are laid out in misleading ways.
- **Topological loss:** tearing, hole collapse, bridge breakage, and other failures to preserve continuity or genus.
- **Metric distortion:** cases where density or absolute distances are visually normalized into misleading similarity.
- **Optimization sensitivity:** how initialization and interactive steering can escape poor local minima or reveal trade-offs.

## Probe Suite

The repository includes a core suite of probe datasets introduced for diagnosing UMAP behavior:

- `Antipodal-Clusters`: global symmetry failure and initialization sensitivity.
- `Two-Moons`: topological tearing and manifold continuity.
- `Enclosed-Blob`: multi-scale nesting and enclosure relationships.
- `Swiss-Roll`: unfolding quality and tearing during flattening.
- `Uniform-Strip`: continuity preservation.
- `Torus-Surface`: genus preservation and hole collapse.
- `S-Curve`: intrinsic vs. extrinsic geometry.
- `Density-Contrast`: local metric normalization and density distortion.
- `Distance-Contrast`: mismatch between embedding distance and 3D separation.
- `Connected-Blobs`: sparse bridge fragility under density imbalance.

Additional bundled cases, and configurable `Gaussian-Blobs` for custom experiments.

## Interaction Workflow

1. Select a bundled dataset or generate a new synthetic case in the browser.
2. Inspect the 3D probe and the 2D UMAP embedding side by side.
3. Tune hyperparameters and compare how the embedding changes.
4. Enable manual mode to select points, drag them in 2D, and inject prior structure into the next run.
5. Review projection history, morph between results, and highlight unstable points.

## Local Development

### Requirements

- Node.js 20+ recommended
- npm

### Install

```bash
npm install
```

### Start the dev server

```bash
npm run dev
```

Then open `http://localhost:5173`.

Notes:

- `npm run build` generates a static production build in `build/`.
- Bundled datasets and precomputed spectral initializations live in `static/datasets/`.
- The app does not require a backend; datasets are loaded from static assets or generated client-side.

## Research Context

This project accompanies the paper:

**Demystifying UMAP artifacts: An interactive study on diagnosis and steering using 3D probes**

**Paper:** [Information Visualization / DOI: 10.1177/14738716261434908](https://doi.org/10.1177/14738716261434908)

Published in **Information Visualization** as part of the **PacificVis 2026 VisMeetsAI** special issue. First published online on **April 5, 2026**.

<details>
<summary>Abstract</summary>

Uniform Manifold Approximation and Projection (UMAP) has become a ubiquitous tool for high-dimensional data visualization, yet its interpretation is often hindered by the "cartographic fallacy" - a cognitive bias where the embedding layout is assumed to be a faithful map of the data's intrinsic geometry, leading users to mistake algorithmic side-effects for genuine data properties. These artifacts stem not only from stochastic optimization but also from inherent mathematical assumptions regarding simplicial approximation and metric normalization. In this work, we present an interactive study aimed at diagnosing these mechanisms. We introduce a classification system derived from a suite of 10 synthetic 3D "probe" datasets, categorizing distortions into spatial logic failures, topological loss, and metric distortion. Furthermore, we demonstrate a human-in-the-loop framework that pairs layout steering with parameter tuning to correct optimization traps and reveal topological trade-offs. This approach transforms UMAP, which is in its current form a static black box, into an explorable educational instrument, helping practitioners distinguish between genuine data features and algorithmic artifacts.

</details>

## Citation

If this repository is useful in your research, please cite:

Chen, B., Xue, Y., Paetzold, P., and Deussen, O. (2026). *Demystifying UMAP artifacts: An interactive study on diagnosis and steering using 3D probes*. Information Visualization, 25(3). https://doi.org/10.1177/14738716261434908

```bibtex
@article{chen2026demystifying,
  title = {Demystifying UMAP artifacts: An interactive study on diagnosis and steering using 3D probes},
  author = {Chen, Bin and Xue, Yumeng and Paetzold, Patrick and Deussen, Oliver},
  journal = {Information Visualization},
  year = {2026},
  volume = {25},
  number = {3},
  doi = {10.1177/14738716261434908},
  url = {https://doi.org/10.1177/14738716261434908}
}
```

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
