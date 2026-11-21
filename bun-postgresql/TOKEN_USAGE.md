# Token usage — bun-postgresql

Sessions: `0e7c9604-571a-48b4-8a57-0e20b4b9ab3e`, `0b04d438-779d-4b00-9ce4-6cddf244cc66`, `d9bc5ce3-4943-4423-9027-a71d643729fc` · generated 2026-11-21
Source: Claude Code transcripts, API `usage` per assistant message (de-duplicated by message id). Main-session rows cover the whole conversation.
Input = uncached input · Cache write = prompt cached on that call · Cache read = cached prompt re-read (billed far lower) · Total = all four.
Weighted* = approx. cost in input-token units: input + 1.25×cache write + 0.1×cache read + 5×output (compare within one model; models differ in price).

## By model
| Model | Agents | Input | Cache write | Cache read | Output | Total | Weighted* |
|---|---:|---:|---:|---:|---:|---:|---:|
| opus 5.5 | 0 | 130 | 309,156 | 7,169,868 | 125,835 | 7,604,989 | 1,732,737 |
| haiku 5.5 | 23 | 224 | 848,480 | 1,842,137 | 317,787 | 3,008,628 | 2,833,973 |
| sonnet 5.5 | 53 | 516 | 1,847,956 | 5,254,741 | 486,439 | 7,589,652 | 5,268,130 |
| **All** | **76** | **870** | **3,005,592** | **14,266,746** | **930,061** | **18,203,269** | **9,834,840** |

## By phase
| Phase | Agents | Input | Cache write | Cache read | Output | Total | Weighted* |
|---|---:|---:|---:|---:|---:|---:|---:|
| Orchestrator (main session) | 0 | 130 | 309,156 | 7,169,868 | 125,835 | 7,604,989 | 1,732,737 |
| Phase 1 version | 1 | 10 | 49,586 | 186,573 | 1,544 | 237,713 | 88,370 |
| Phase 1 version-notes | 1 | 14 | 66,630 | 310,889 | 10,962 | 388,495 | 169,200 |
| Phase 2 plans | 3 | 34 | 130,962 | 704,454 | 16,625 | 852,075 | 317,307 |
| Phase 5 fix | 25 | 310 | 436,522 | 2,244,013 | 86,224 | 2,767,069 | 1,201,483 |
| Phase 3 content | 22 | 162 | 916,642 | 1,727,573 | 361,035 | 3,005,412 | 3,123,898 |
| Phase 5 accuracy | 8 | 70 | 472,548 | 853,237 | 52,962 | 1,378,817 | 940,888 |
| Phase 5 re-verify | 12 | 116 | 320,491 | 963,583 | 90,568 | 1,374,758 | 949,927 |
| Phase 5 clarity | 4 | 24 | 303,055 | 106,556 | 184,306 | 593,941 | 1,311,030 |
| **All** | **76** | **870** | **3,005,592** | **14,266,746** | **930,061** | **18,203,269** | **9,834,840** |

## Per agent
| Phase | Task | Model | API calls | Input | Cache write | Cache read | Output | Total | Weighted* |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| Orchestrator (main session) | Planning + coordination | opus 5.5 | 36 | 72 | 165,250 | 4,978,333 | 108,984 | 5,252,639 | 1,249,388 |
| Phase 5 clarity | clarity 19–22 | haiku 5.5 | 3 | 6 | 72,411 | 24,029 | 55,741 | 152,187 | 371,628 |
| Phase 5 clarity | clarity 13–18 | haiku 5.5 | 3 | 6 | 81,116 | 28,215 | 43,667 | 153,004 | 322,558 |
| Phase 5 clarity | clarity 01–06 | haiku 5.5 | 3 | 6 | 70,998 | 25,330 | 45,607 | 141,941 | 319,322 |
| Phase 5 clarity | clarity 07–12 | haiku 5.5 | 3 | 6 | 78,530 | 28,982 | 39,291 | 146,809 | 297,522 |
| Orchestrator (main session) | Planning + coordination | opus 5.5 | 14 | 28 | 98,570 | 1,104,506 | 12,622 | 1,215,726 | 296,801 |
| Phase 5 re-verify | clarity 07–12 | haiku 5.5 | 4 | 8 | 67,325 | 107,202 | 35,453 | 209,988 | 272,149 |
| Phase 3 content | 20-auth | sonnet 5.5 | 4 | 8 | 54,986 | 109,495 | 29,820 | 194,309 | 228,790 |
| Phase 3 content | 18-layered-architecture | sonnet 5.5 | 3 | 6 | 50,586 | 47,309 | 26,591 | 124,492 | 200,924 |
| Orchestrator (main session) | Planning + coordination | opus 5.5 | 15 | 30 | 45,336 | 1,087,029 | 4,229 | 1,136,624 | 186,548 |
| Phase 3 content | 08-http-bun-serve | sonnet 5.5 | 4 | 8 | 47,211 | 101,738 | 22,027 | 170,984 | 179,331 |
| Phase 3 content | 11-schema-constraints | sonnet 5.5 | 4 | 8 | 46,428 | 100,213 | 21,986 | 168,635 | 177,994 |
| Phase 3 content | 21-logging-shutdown | sonnet 5.5 | 4 | 8 | 45,618 | 98,762 | 21,817 | 166,205 | 175,992 |
| Phase 3 content | 22-testing | sonnet 5.5 | 4 | 8 | 45,887 | 99,924 | 21,193 | 167,012 | 173,324 |
| Phase 5 re-verify | clarity 13–18 | haiku 5.5 | 6 | 12 | 48,271 | 179,992 | 18,791 | 247,066 | 172,305 |
| Phase 1 version-notes | bun-postgresql | sonnet 5.5 | 7 | 14 | 66,630 | 310,889 | 10,962 | 388,495 | 169,200 |
| Phase 3 content | 19-validation-errors | sonnet 5.5 | 3 | 6 | 50,626 | 41,895 | 19,861 | 112,388 | 166,783 |
| Phase 3 content | 15-transactions-concurrency | sonnet 5.5 | 4 | 8 | 43,652 | 97,671 | 18,976 | 160,307 | 159,220 |
| Phase 5 re-verify | clarity 19–22 | haiku 5.5 | 5 | 10 | 52,524 | 120,238 | 16,036 | 188,808 | 157,869 |
| Phase 3 content | 17-indexes-performance | sonnet 5.5 | 3 | 6 | 43,867 | 48,067 | 19,114 | 111,054 | 155,216 |
| Phase 5 accuracy | accuracy 13–15 | sonnet 5.5 | 4 | 8 | 68,084 | 79,622 | 10,066 | 157,780 | 143,405 |
| Phase 5 accuracy | accuracy 19–21 | sonnet 5.5 | 4 | 8 | 72,901 | 95,821 | 7,475 | 176,205 | 138,091 |
| Phase 3 content | 09-relational-postgresql | sonnet 5.5 | 3 | 6 | 41,381 | 48,446 | 16,251 | 106,084 | 137,832 |
| Phase 5 accuracy | accuracy 10–12 | sonnet 5.5 | 6 | 12 | 59,780 | 217,842 | 8,162 | 285,796 | 137,331 |
| Phase 5 accuracy | accuracy 04–06 | sonnet 5.5 | 5 | 10 | 60,278 | 147,202 | 8,918 | 216,408 | 134,668 |
| Phase 3 content | 13-bun-sql | sonnet 5.5 | 4 | 8 | 44,865 | 87,368 | 13,432 | 145,673 | 131,986 |
| Phase 5 accuracy | accuracy 16–18 | sonnet 5.5 | 4 | 8 | 63,411 | 86,729 | 7,471 | 157,619 | 125,300 |
| Phase 2 plans | api-facts bun-runtime | sonnet 5.5 | 8 | 16 | 38,314 | 405,633 | 6,799 | 450,762 | 122,467 |
| Phase 3 content | 04-arrays-objects-types | sonnet 5.5 | 3 | 6 | 38,315 | 47,843 | 13,906 | 100,070 | 122,214 |
| Phase 3 content | 14-migrations | sonnet 5.5 | 4 | 8 | 37,281 | 90,703 | 12,823 | 140,815 | 119,795 |
| Phase 3 content | 10-sql-crud | sonnet 5.5 | 4 | 8 | 36,572 | 89,712 | 12,775 | 139,067 | 118,569 |
| Phase 3 content | 06-modules-folder-structure | sonnet 5.5 | 4 | 8 | 37,110 | 91,384 | 12,295 | 140,797 | 117,009 |
| Phase 3 content | 07-config-environment | sonnet 5.5 | 3 | 6 | 37,140 | 47,308 | 13,142 | 97,596 | 116,872 |
| Phase 3 content | 12-joins-aggregation | sonnet 5.5 | 3 | 6 | 36,874 | 47,103 | 13,087 | 97,070 | 116,244 |
| Phase 3 content | 05-errors-async | sonnet 5.5 | 4 | 8 | 35,578 | 89,014 | 11,601 | 136,201 | 111,387 |
| Phase 3 content | 16-upserts-jsonb | sonnet 5.5 | 4 | 8 | 35,548 | 88,946 | 11,493 | 135,995 | 110,803 |
| Phase 5 accuracy | accuracy 07–09 | sonnet 5.5 | 5 | 10 | 58,702 | 124,698 | 4,441 | 187,851 | 108,062 |
| Phase 3 content | 02-values-variables | sonnet 5.5 | 4 | 8 | 34,832 | 88,247 | 10,442 | 133,529 | 104,583 |
| Phase 3 content | 03-control-flow-functions | sonnet 5.5 | 4 | 8 | 34,366 | 87,715 | 10,476 | 132,565 | 104,117 |
| Phase 2 plans | api-facts bun-sql | sonnet 5.5 | 5 | 10 | 34,964 | 227,432 | 6,323 | 268,729 | 98,073 |
| Phase 2 plans | api-facts bun-sql-2 | haiku 5.5 | 4 | 8 | 57,684 | 71,389 | 3,503 | 132,584 | 96,767 |
| Phase 3 content | 01-how-backends-work | sonnet 5.5 | 4 | 8 | 37,919 | 78,710 | 7,927 | 124,564 | 94,913 |
| Phase 1 version | bun-postgresql | haiku 5.5 | 5 | 10 | 49,586 | 186,573 | 1,544 | 237,713 | 88,370 |
| Phase 5 re-verify | clarity 01–06 | haiku 5.5 | 3 | 6 | 35,386 | 44,336 | 7,819 | 87,547 | 87,767 |
| Phase 5 fix | 22-testing r1 | sonnet 5.5 | 14 | 28 | 19,169 | 256,798 | 7,401 | 283,396 | 86,674 |
| Phase 5 accuracy | accuracy 01–03 | sonnet 5.5 | 3 | 6 | 50,215 | 21,742 | 3,236 | 75,199 | 81,129 |
| Phase 5 fix | 21-logging-shutdown r1 | haiku 5.5 | 6 | 12 | 28,375 | 125,627 | 6,413 | 160,427 | 80,108 |
| Phase 5 fix | 17-indexes-performance r1 | haiku 5.5 | 5 | 10 | 33,222 | 87,526 | 5,400 | 126,158 | 77,290 |
| Phase 5 fix | 20-auth r1 | sonnet 5.5 | 6 | 12 | 30,774 | 105,125 | 5,110 | 141,021 | 74,542 |
| Phase 5 accuracy | accuracy 22-testing | sonnet 5.5 | 4 | 8 | 39,177 | 79,581 | 3,193 | 121,959 | 72,902 |
| Phase 5 fix | 12-joins-aggregation r2 | haiku 5.5 | 7 | 14 | 18,919 | 107,007 | 6,527 | 132,467 | 66,998 |
| Phase 5 fix | 09-relational-postgresql r1 | haiku 5.5 | 6 | 12 | 18,966 | 98,358 | 5,149 | 122,485 | 59,300 |
| Phase 5 fix | 08-http-bun-serve r1 | sonnet 5.5 | 8 | 16 | 20,543 | 113,830 | 3,240 | 137,629 | 53,278 |
| Phase 5 fix | 01-how-backends-work r1 | haiku 5.5 | 8 | 16 | 19,165 | 106,506 | 3,663 | 129,350 | 52,938 |
| Phase 5 fix | 11-schema-constraints r1 | haiku 5.5 | 9 | 18 | 14,571 | 129,024 | 3,989 | 147,602 | 51,079 |
| Phase 5 re-verify | accuracy 08–12 | sonnet 5.5 | 5 | 10 | 27,837 | 82,516 | 1,558 | 111,921 | 50,848 |
| Phase 5 fix | 12-joins-aggregation r1 | sonnet 5.5 | 8 | 16 | 16,685 | 128,018 | 3,177 | 147,896 | 49,559 |
| Phase 5 fix | 19-validation-errors r1 | haiku 5.5 | 4 | 8 | 19,223 | 40,712 | 4,003 | 63,946 | 48,123 |
| Phase 5 fix | 06-modules-folder-structure r1 | sonnet 5.5 | 7 | 14 | 14,989 | 103,786 | 3,519 | 122,308 | 46,724 |
| Phase 5 fix | 15-transactions-concurrency r1 | sonnet 5.5 | 8 | 16 | 16,116 | 125,942 | 2,712 | 144,786 | 46,315 |
| Phase 5 fix | 18-layered-architecture r1 | haiku 5.5 | 5 | 10 | 15,415 | 64,072 | 3,978 | 83,475 | 45,576 |
| Phase 5 re-verify | accuracy 13–15 | sonnet 5.5 | 6 | 12 | 18,428 | 90,454 | 2,375 | 111,269 | 43,967 |
| Phase 5 fix | 13-bun-sql r1 | sonnet 5.5 | 7 | 14 | 17,472 | 87,903 | 2,375 | 107,764 | 42,519 |
| Phase 5 fix | 07-config-environment r1 | haiku 5.5 | 4 | 8 | 18,781 | 42,172 | 2,684 | 63,645 | 41,121 |
| Phase 5 fix | 14-migrations r1 | sonnet 5.5 | 4 | 8 | 18,599 | 53,084 | 2,390 | 74,081 | 40,515 |
| Phase 5 re-verify | accuracy 02–05 | sonnet 5.5 | 7 | 14 | 13,446 | 93,798 | 2,497 | 109,755 | 38,686 |
| Phase 5 re-verify | accuracy 20–22 | sonnet 5.5 | 5 | 10 | 18,906 | 68,869 | 1,509 | 89,294 | 38,074 |
| Phase 5 fix | 04-arrays-objects-types r1 | haiku 5.5 | 4 | 8 | 15,633 | 49,426 | 2,592 | 67,659 | 37,452 |
| Phase 5 fix | 02-values-variables r1 | sonnet 5.5 | 5 | 10 | 16,090 | 55,405 | 1,688 | 73,193 | 34,103 |
| Phase 5 fix | 10-sql-crud r1 | haiku 5.5 | 5 | 10 | 12,135 | 63,859 | 2,296 | 78,300 | 33,045 |
| Phase 5 fix | 05-errors-async r1 | sonnet 5.5 | 5 | 10 | 12,676 | 64,663 | 2,077 | 79,426 | 32,706 |
| Phase 5 fix | 03-control-flow-functions r1 | sonnet 5.5 | 5 | 10 | 10,709 | 62,185 | 1,658 | 74,562 | 27,905 |
| Phase 5 re-verify | clarity 08–12 | haiku 5.5 | 4 | 8 | 10,603 | 38,925 | 2,131 | 51,667 | 27,809 |
| Phase 5 re-verify | accuracy 06-modules-folder-structure | sonnet 5.5 | 6 | 12 | 11,305 | 73,476 | 1,207 | 86,000 | 27,526 |
| Phase 5 fix | 08-http-bun-serve r2 | haiku 5.5 | 6 | 12 | 9,641 | 72,637 | 1,510 | 83,800 | 26,877 |
| Phase 5 fix | 16-upserts-jsonb r1 | sonnet 5.5 | 4 | 8 | 10,449 | 44,465 | 1,849 | 56,771 | 26,761 |
| Phase 5 fix | 14-migrations r2 | sonnet 5.5 | 5 | 10 | 8,205 | 55,883 | 824 | 64,922 | 19,975 |
| Phase 5 re-verify | accuracy 16-upserts-jsonb | sonnet 5.5 | 3 | 6 | 8,701 | 26,534 | 598 | 35,839 | 16,526 |
| Phase 5 re-verify | accuracy 14-migrations | sonnet 5.5 | 4 | 8 | 7,759 | 37,243 | 594 | 45,604 | 16,401 |

## Notes
- Subagents: 76, 10,598,280 tokens (weighted 8,102,103). Main session: 7,604,989 tokens (weighted 1,732,737), 94.3% cache reads.
- Dollar cost not computed; run `/cost` in Claude Code.
