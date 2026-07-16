#!/usr/bin/env python3
from huggingface_hub import model_info

ids = [
    "meta-llama/Prompt-Guard-86M",
    "meta-llama/Llama-Prompt-Guard-2-86M",
    "meta-llama/Llama-Guard-3-1B",
    "Qwen/Qwen3Guard-Gen-0.6B",
    "walledai/walledguard-edge",
    "ibm-granite/granite-guardian-3.2-3b-a800m",
    "google/functiongemma-270m-it",
    "Qwen/Qwen2.5-0.5B-Instruct",
    "Qwen/Qwen3-0.6B",
    "Qwen/Qwen3-1.7B",
    "Qwen/Qwen2.5-3B-Instruct",
    "Qwen/Qwen2.5-Coder-3B-Instruct",
    "Qwen/Qwen2.5-Coder-0.5B-Instruct",
    "WeiboAI/VibeThinker-3B",
    "huggermax/VibeThinker-3B-tool-calling-GGUF",
    "RefinedNeuro/VibeThinker-3B-Hermes-GGUF",
    "prithivMLmods/VibeThinker-3B-heretic_decensored-GGUF",
    "NousResearch/Hermes-3-Llama-3.2-3B",
    "AngelSlim/Qwen3-1.7B_eagle3",
    "huihui-ai/Qwen2.5-0.5B-Instruct-CensorTune",
    "shawhin/Qwen2.5-0.5B-DPO",
    "unsloth/Qwen2.5-0.5B-Instruct",
    "google/gemma-3-1b-it",
    "Andycurrent/Gemma-3-1B-it-GLM-4.7-Flash-Heretic-Uncensored-Thinking_GGUF",
    "Qwen/Qwen3-Embedding-0.6B",
    "Nanbeige/CoSineVerifier-Tool-4B",
    "mradermacher/fable-qwen2.5-3b-agentic-merged-heretic-i1-GGUF",
    "refinedneuro/refinedtoolcallv5-3b",
    "usermma/Mythos-nano-OBLITERATED",
    "potteryrage/bashgemma-270m",
    "z-lab/Qwen3.6-35B-A3B-DFlash",
    "yuhuili/EAGLE3-LLaMA3.1-Instruct-8B",
]

for mid in ids:
    try:
        m = model_info(mid)
        print(
            f"{getattr(m, 'downloads', 0) or 0:>9}  likes={getattr(m, 'likes', 0) or 0:<4}  {mid}"
        )
    except Exception as e:
        print(f" MISSING  {mid}  ({type(e).__name__}: {e})")
