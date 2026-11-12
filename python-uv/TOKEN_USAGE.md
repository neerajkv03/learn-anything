# Token usage — python-uv

Sessions: `b7b4729a-2961-4317-aada-af984b79cc16`, `de0083c9-0c4d-4d18-8da7-e7b92bff7323`, `e22cec3a-60d2-42b4-b447-3e225cc013c9`, `9920c163-cdb6-4918-992a-210c0cf9e023` · generated 2026-11-12
Source: Claude Code transcripts, API `usage` per assistant message (de-duplicated by message id). Main-session rows cover the whole conversation.
Input = uncached input · Cache write = prompt cached on that call · Cache read = cached prompt re-read (billed far lower) · Total = all four.
Weighted* = approx. cost in input-token units: input + 1.25×cache write + 0.1×cache read + 5×output (compare within one model; models differ in price).

## By model
| Model | Agents | Input | Cache write | Cache read | Output | Total | Weighted* |
|---|---:|---:|---:|---:|---:|---:|---:|
| opus 5.5 | 0 | 310 | 513,190 | 30,208,004 | 227,097 | 30,948,601 | 4,798,083 |
| sonnet 5.5 | 75 | 764 | 2,625,999 | 14,192,735 | 472,889 | 17,292,387 | 7,066,982 |
| haiku 5.5 | 13 | 84 | 838,480 | 1,510,782 | 256,718 | 2,606,064 | 2,482,853 |
| **All** | **88** | **1,158** | **3,977,669** | **45,911,521** | **956,704** | **50,847,052** | **14,347,918** |

## By phase
| Phase | Agents | Input | Cache write | Cache read | Output | Total | Weighted* |
|---|---:|---:|---:|---:|---:|---:|---:|
| Orchestrator (main session) | 0 | 310 | 513,190 | 30,208,004 | 227,097 | 30,948,601 | 4,798,083 |
| Phase 1 version | 2 | 18 | 96,775 | 297,397 | 4,152 | 398,342 | 171,487 |
| Phase 3 content | 35 | 318 | 1,239,965 | 6,104,299 | 344,732 | 7,689,314 | 3,884,363 |
| Phase 4 app | 5 | 38 | 266,492 | 775,898 | 81,526 | 1,123,954 | 818,372 |
| Phase 5 accuracy | 12 | 86 | 506,478 | 1,254,701 | 36,273 | 1,797,538 | 940,020 |
| Phase 5 clarity | 6 | 44 | 423,281 | 983,302 | 182,360 | 1,588,987 | 1,539,276 |
| Phase 5 fix | 19 | 248 | 433,095 | 4,324,170 | 51,776 | 4,809,289 | 1,232,914 |
| Phase 5 re-verify | 7 | 76 | 370,035 | 1,509,286 | 23,281 | 1,902,678 | 729,954 |
| Phase 2 plans | 1 | 14 | 78,870 | 362,842 | 4,124 | 445,850 | 155,506 |
| Phase 2 version | 1 | 6 | 49,488 | 91,622 | 1,383 | 142,499 | 77,943 |
| **All** | **88** | **1,158** | **3,977,669** | **45,911,521** | **956,704** | **50,847,052** | **14,347,918** |

## Per agent
| Phase | Task | Model | API calls | Input | Cache write | Cache read | Output | Total | Weighted* |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| Orchestrator (main session) | Planning + coordination | opus 5.5 | 116 | 234 | 303,486 | 26,711,682 | 146,685 | 27,162,087 | 3,784,185 |
| Orchestrator (main session) | Planning + coordination | opus 5.5 | 18 | 36 | 115,460 | 2,077,433 | 69,394 | 2,262,323 | 699,074 |
| Phase 5 clarity | clarity 31–35 | haiku 5.5 | 3 | 6 | 87,672 | 49,725 | 51,852 | 189,255 | 373,829 |
| Phase 5 clarity | clarity 25–30 | haiku 5.5 | 2 | 4 | 70,177 | 8,762 | 47,449 | 126,392 | 325,846 |
| Phase 4 app | Build app (index.html, style.css, app.js) | sonnet 5.5 | 5 | 10 | 86,095 | 246,570 | 23,266 | 355,941 | 248,616 |
| Phase 4 app | DESIGN.md checklist review #2 | haiku 5.5 | 2 | 4 | 53,108 | 66,803 | 30,566 | 150,481 | 225,899 |
| Phase 4 app | DESIGN.md checklist review #1 | haiku 5.5 | 2 | 4 | 77,301 | 42,141 | 24,832 | 144,278 | 225,004 |
| Phase 5 clarity | 19–24 | haiku 5.5 | 6 | 12 | 75,760 | 399,617 | 17,314 | 492,703 | 221,244 |
| Phase 5 clarity | 13–18 | haiku 5.5 | 5 | 10 | 75,095 | 296,092 | 19,405 | 390,602 | 220,513 |
| Phase 5 clarity | 01–06 | haiku 5.5 | 3 | 6 | 55,618 | 114,556 | 24,040 | 194,220 | 201,184 |
| Phase 5 clarity | 07–12 | haiku 5.5 | 3 | 6 | 58,959 | 114,550 | 22,300 | 195,815 | 196,660 |
| Phase 5 fix | 01–03 | sonnet 5.5 | 12 | 24 | 56,021 | 719,779 | 7,691 | 783,515 | 180,483 |
| Orchestrator (main session) | Planning + coordination | opus 5.5 | 12 | 24 | 51,014 | 881,821 | 4,772 | 937,631 | 175,834 |
| Phase 2 plans | build _taught.md | sonnet 5.5 | 7 | 14 | 78,870 | 362,842 | 4,124 | 445,850 | 155,506 |
| Phase 5 re-verify | 19–24 | sonnet 5.5 | 8 | 18 | 72,497 | 464,629 | 3,489 | 540,633 | 154,547 |
| Phase 3 content | 03-operators-expressions | sonnet 5.5 | 6 | 12 | 60,421 | 264,081 | 10,136 | 334,650 | 152,626 |
| Phase 3 content | 22-concurrency-asyncio | sonnet 5.5 | 6 | 12 | 40,325 | 299,830 | 13,398 | 353,565 | 147,391 |
| Phase 3 content | 19-stdlib-essentials | sonnet 5.5 | 6 | 12 | 39,837 | 298,624 | 13,012 | 351,485 | 144,731 |
| Phase 3 content | 20-testing-pytest | sonnet 5.5 | 6 | 12 | 39,509 | 297,205 | 12,956 | 349,682 | 143,899 |
| Phase 5 fix | 07–09 | sonnet 5.5 | 11 | 22 | 41,319 | 582,273 | 6,571 | 630,185 | 142,753 |
| Orchestrator (main session) | Planning + coordination | opus 5.5 | 8 | 16 | 43,230 | 537,068 | 6,246 | 586,560 | 138,990 |
| Phase 3 content | 23-scripts-packaging | sonnet 5.5 | 6 | 12 | 38,329 | 294,659 | 11,816 | 344,816 | 136,469 |
| Phase 3 content | 18-decorators-context-managers | sonnet 5.5 | 6 | 12 | 37,830 | 293,599 | 11,565 | 343,006 | 134,484 |
| Phase 3 content | 14-files-paths-data | sonnet 5.5 | 6 | 12 | 37,876 | 293,499 | 11,458 | 342,845 | 133,997 |
| Phase 3 content | 12-modules-imports | sonnet 5.5 | 6 | 12 | 37,604 | 292,564 | 11,482 | 341,662 | 133,683 |
| Phase 3 content | 31-fastapi-sqlmodel | sonnet 5.5 | 4 | 8 | 33,573 | 77,885 | 16,510 | 127,976 | 132,313 |
| Phase 3 content | 21-code-quality | sonnet 5.5 | 6 | 12 | 37,532 | 292,943 | 11,137 | 341,624 | 131,906 |
| Phase 3 content | 17-iterators-generators | sonnet 5.5 | 6 | 12 | 37,052 | 291,147 | 11,290 | 339,501 | 131,892 |
| Phase 5 fix | 04–06 | sonnet 5.5 | 11 | 22 | 37,809 | 557,803 | 5,755 | 601,389 | 131,839 |
| Phase 3 content | 01-setup-with-uv | sonnet 5.5 | 6 | 12 | 58,002 | 264,895 | 6,402 | 329,311 | 131,014 |
| Phase 3 content | 09-functions | sonnet 5.5 | 5 | 10 | 37,868 | 236,994 | 11,292 | 286,164 | 127,504 |
| Phase 5 fix | 19–21 | sonnet 5.5 | 12 | 24 | 35,194 | 616,826 | 3,900 | 655,944 | 125,199 |
| Phase 5 re-verify | clarity 31–35 | haiku 5.5 | 2 | 4 | 69,945 | 15,184 | 7,050 | 92,183 | 124,204 |
| Phase 3 content | 34-fastapi-testing | sonnet 5.5 | 4 | 8 | 31,927 | 76,349 | 15,203 | 123,487 | 123,567 |
| Phase 3 content | 02-variables-types | sonnet 5.5 | 4 | 8 | 58,183 | 150,881 | 6,757 | 215,829 | 121,610 |
| Phase 5 re-verify | clarity 25–30 | haiku 5.5 | 2 | 4 | 68,582 | 14,333 | 6,375 | 89,294 | 119,040 |
| Phase 5 re-verify | 01–06 | sonnet 5.5 | 6 | 12 | 59,485 | 303,879 | 1,887 | 365,263 | 114,191 |
| Phase 3 content | 29-fastapi-requests-responses | sonnet 5.5 | 4 | 8 | 29,182 | 72,186 | 13,355 | 114,731 | 110,479 |
| Phase 5 fix | 22–24 | sonnet 5.5 | 8 | 16 | 37,914 | 391,725 | 4,649 | 434,304 | 109,826 |
| Phase 5 re-verify | 10–16 | sonnet 5.5 | 8 | 18 | 46,476 | 407,641 | 2,187 | 456,322 | 109,812 |
| Phase 1 version | fastapi-sqlite | haiku 5.5 | 7 | 14 | 52,257 | 293,445 | 2,965 | 348,681 | 109,505 |
| Phase 3 content | 32-fastapi-structure | sonnet 5.5 | 5 | 10 | 28,767 | 105,577 | 12,506 | 146,860 | 109,056 |
| Phase 5 fix | 13–16 | sonnet 5.5 | 8 | 16 | 36,244 | 388,887 | 3,862 | 429,009 | 103,520 |
| Phase 3 content | 15-classes-objects | sonnet 5.5 | 4 | 8 | 35,412 | 177,676 | 8,121 | 221,217 | 102,646 |
| Phase 3 content | 08-comprehensions-unpacking | sonnet 5.5 | 5 | 10 | 33,967 | 233,379 | 7,146 | 274,502 | 101,537 |
| Phase 3 content | 24-production-workflow | sonnet 5.5 | 4 | 8 | 34,597 | 177,238 | 7,549 | 219,392 | 98,723 |
| Phase 3 content | 33-fastapi-auth | sonnet 5.5 | 3 | 6 | 28,682 | 39,072 | 11,691 | 79,451 | 98,221 |
| Phase 3 content | 25-sqlite-sqlite3 | sonnet 5.5 | 3 | 6 | 33,433 | 33,561 | 10,585 | 77,585 | 98,078 |
| Phase 5 accuracy | 22–24 | sonnet 5.5 | 4 | 10 | 46,819 | 182,673 | 4,101 | 233,603 | 97,306 |
| Phase 3 content | 13-uv-projects | sonnet 5.5 | 4 | 8 | 34,392 | 176,528 | 7,263 | 218,191 | 96,966 |
| Phase 5 accuracy | 19–21 | sonnet 5.5 | 4 | 10 | 45,585 | 181,544 | 4,051 | 231,190 | 95,401 |
| Phase 5 accuracy | 13–15 | sonnet 5.5 | 4 | 10 | 45,031 | 187,498 | 3,860 | 236,399 | 94,349 |
| Phase 3 content | 10-type-hints | sonnet 5.5 | 4 | 8 | 33,613 | 175,397 | 6,897 | 215,915 | 94,049 |
| Phase 3 content | 16-dataclasses-enums | sonnet 5.5 | 4 | 8 | 33,355 | 174,962 | 6,836 | 215,161 | 93,378 |
| Phase 3 content | 07-collections | sonnet 5.5 | 4 | 8 | 33,373 | 175,111 | 6,636 | 215,128 | 92,415 |
| Phase 3 content | 30-fastapi-dependencies | sonnet 5.5 | 5 | 10 | 25,447 | 97,988 | 10,059 | 133,504 | 91,913 |
| Phase 3 content | 11-error-handling | sonnet 5.5 | 4 | 8 | 33,094 | 174,729 | 6,486 | 214,317 | 91,278 |
| Phase 5 re-verify | 07–09 | sonnet 5.5 | 6 | 14 | 42,644 | 277,225 | 1,902 | 321,785 | 90,552 |
| Phase 3 content | 35-fastapi-async-deploy | sonnet 5.5 | 4 | 8 | 26,339 | 69,912 | 9,712 | 105,971 | 88,483 |
| Phase 3 content | 28-fastapi-first-app | sonnet 5.5 | 4 | 8 | 25,625 | 68,912 | 9,868 | 104,413 | 88,270 |
| Phase 3 content | 04-strings | sonnet 5.5 | 3 | 6 | 33,130 | 117,449 | 6,956 | 157,541 | 87,943 |
| Phase 5 accuracy | 10–12 | sonnet 5.5 | 3 | 8 | 43,143 | 131,579 | 3,153 | 177,883 | 82,860 |
| Phase 5 fix | 10–12 | sonnet 5.5 | 6 | 12 | 33,153 | 269,591 | 2,770 | 305,526 | 82,262 |
| Phase 3 content | 26-http-api-basics | sonnet 5.5 | 3 | 6 | 25,093 | 38,148 | 8,905 | 72,152 | 79,712 |
| Phase 3 content | 05-control-flow | sonnet 5.5 | 3 | 6 | 31,325 | 116,914 | 5,685 | 153,930 | 79,279 |
| Phase 3 content | 27-pydantic-models | sonnet 5.5 | 3 | 6 | 24,590 | 37,619 | 8,931 | 71,146 | 79,160 |
| Phase 2 version | pydantic-settings, pwdlib, PyJWT | haiku 5.5 | 3 | 6 | 49,488 | 91,622 | 1,383 | 142,499 | 77,943 |
| Phase 5 accuracy | 07–09 | sonnet 5.5 | 3 | 8 | 42,370 | 131,856 | 1,981 | 176,215 | 76,061 |
| Phase 5 accuracy | 16–18 | sonnet 5.5 | 3 | 8 | 41,234 | 130,393 | 2,289 | 173,924 | 76,035 |
| Phase 3 content | 06-loops | sonnet 5.5 | 3 | 6 | 30,681 | 116,786 | 5,131 | 152,604 | 75,691 |
| Phase 5 accuracy | accuracy 31–33 | sonnet 5.5 | 2 | 4 | 45,321 | 13,344 | 3,486 | 62,155 | 75,420 |
| Phase 5 accuracy | 01–03 | sonnet 5.5 | 3 | 8 | 40,786 | 130,276 | 2,136 | 173,206 | 74,698 |
| Phase 5 accuracy | 04–06 | sonnet 5.5 | 3 | 8 | 40,306 | 129,806 | 1,984 | 172,104 | 73,291 |
| Phase 5 accuracy | accuracy 28–30 | sonnet 5.5 | 2 | 4 | 39,962 | 13,274 | 4,179 | 57,419 | 72,179 |
| Phase 5 accuracy | accuracy 25–27 | sonnet 5.5 | 2 | 4 | 42,566 | 9,126 | 2,501 | 54,197 | 66,629 |
| Phase 1 version | Verify Python + uv versions (web fetch) | haiku 5.5 | 2 | 4 | 44,518 | 3,952 | 1,187 | 49,661 | 61,982 |
| Phase 4 app | Fix round 2 (router first-load) | sonnet 5.5 | 6 | 12 | 23,981 | 256,057 | 1,176 | 281,226 | 61,474 |
| Phase 4 app | Fix round 1 (skip link, focus, lang label) | sonnet 5.5 | 4 | 8 | 26,007 | 164,327 | 1,686 | 192,028 | 57,379 |
| Phase 5 accuracy | accuracy 34–35 | sonnet 5.5 | 2 | 4 | 33,355 | 13,332 | 2,552 | 49,243 | 55,791 |
| Phase 5 fix | Polish 09 + 24 glosses | sonnet 5.5 | 4 | 8 | 23,367 | 161,141 | 1,117 | 185,633 | 50,916 |
| Phase 5 fix | 32-fastapi-structure r1 | sonnet 5.5 | 4 | 8 | 18,443 | 52,874 | 3,172 | 74,497 | 44,209 |
| Phase 5 fix | 34-fastapi-testing r1 | sonnet 5.5 | 7 | 14 | 14,630 | 104,722 | 1,938 | 121,304 | 38,464 |
| Phase 5 fix | 25-sqlite-sqlite3 r1 | sonnet 5.5 | 6 | 12 | 16,262 | 71,284 | 1,714 | 89,272 | 36,038 |
| Phase 5 fix | 33-fastapi-auth r1 | sonnet 5.5 | 5 | 10 | 12,984 | 65,125 | 1,757 | 79,876 | 31,538 |
| Phase 5 fix | 30-fastapi-dependencies r1 | sonnet 5.5 | 5 | 10 | 12,284 | 63,872 | 1,293 | 77,459 | 28,217 |
| Phase 5 fix | 35-fastapi-async-deploy r1 | sonnet 5.5 | 4 | 8 | 10,872 | 45,881 | 1,298 | 58,059 | 24,676 |
| Phase 5 fix | 26-http-api-basics r1 | sonnet 5.5 | 5 | 10 | 9,710 | 57,983 | 1,150 | 68,853 | 23,696 |
| Phase 5 fix | 28-fastapi-first-app r1 | sonnet 5.5 | 4 | 8 | 9,988 | 44,644 | 1,107 | 55,747 | 22,492 |
| Phase 5 fix | 31-fastapi-sqlmodel r1 | sonnet 5.5 | 5 | 10 | 9,327 | 57,131 | 929 | 67,397 | 22,027 |
| Phase 5 fix | 29-fastapi-requests-responses r1 | sonnet 5.5 | 4 | 8 | 9,053 | 43,351 | 607 | 53,019 | 18,694 |
| Phase 5 re-verify | accuracy 34-fastapi-testing | sonnet 5.5 | 3 | 6 | 10,406 | 26,395 | 391 | 37,198 | 17,608 |
| Phase 5 fix | 27-pydantic-models r1 | sonnet 5.5 | 3 | 6 | 8,521 | 29,278 | 496 | 38,301 | 16,065 |

## Notes
- Subagents: 88, 19,898,451 tokens (weighted 9,549,835). Main session: 30,948,601 tokens (weighted 4,798,083), 97.6% cache reads.
- Dollar cost not computed; run `/cost` in Claude Code.
