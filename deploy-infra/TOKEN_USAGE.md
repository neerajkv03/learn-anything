# Token usage — deploy-infra

Sessions: `0d56d3a5-14e3-4117-91ec-be4d301112ca`, `18a7590b-eb2b-4811-a13b-f4d5e4394785`, `07542fcf-acab-4d4f-b16c-74e5ab7a7e6d` · generated 2026-11-21
Source: Claude Code transcripts, API `usage` per assistant message (de-duplicated by message id). Main-session rows cover the whole conversation.
Input = uncached input · Cache write = prompt cached on that call · Cache read = cached prompt re-read (billed far lower) · Total = all four.
Weighted* = approx. cost in input-token units: input + 1.25×cache write + 0.1×cache read + 5×output (compare within one model; models differ in price).

## By model
| Model | Agents | Input | Cache write | Cache read | Output | Total | Weighted* |
|---|---:|---:|---:|---:|---:|---:|---:|
| opus 5.5 | 0 | 110 | 338,751 | 5,833,295 | 161,287 | 6,333,443 | 1,813,313 |
| haiku 5.5 | 20 | 200 | 867,703 | 1,827,184 | 366,607 | 3,061,694 | 3,100,583 |
| sonnet 5.5 | 66 | 748 | 3,737,045 | 15,757,989 | 698,811 | 20,194,593 | 9,741,913 |
| **All** | **86** | **1,058** | **4,943,499** | **23,418,468** | **1,226,705** | **29,589,730** | **14,655,809** |

## By phase
| Phase | Agents | Input | Cache write | Cache read | Output | Total | Weighted* |
|---|---:|---:|---:|---:|---:|---:|---:|
| Orchestrator (main session) | 0 | 110 | 338,751 | 5,833,295 | 161,287 | 6,333,443 | 1,813,313 |
| Phase 1 version | 2 | 16 | 102,518 | 343,730 | 5,513 | 451,777 | 190,102 |
| Phase 1 version-notes | 2 | 24 | 182,205 | 666,539 | 19,637 | 868,405 | 392,620 |
| Phase 2 api-facts | 4 | 100 | 873,894 | 6,574,608 | 79,031 | 7,527,633 | 2,145,084 |
| Phase 5 fix | 28 | 346 | 499,568 | 2,589,013 | 101,466 | 3,190,393 | 1,391,038 |
| Phase 5 re-verify | 15 | 114 | 422,722 | 876,777 | 116,937 | 1,416,550 | 1,200,880 |
| Phase 5 accuracy | 8 | 106 | 884,380 | 2,990,786 | 104,961 | 3,980,233 | 1,929,465 |
| Phase 3 content | 23 | 218 | 1,275,165 | 3,443,035 | 420,737 | 5,139,155 | 4,042,165 |
| Phase 5 clarity | 4 | 24 | 364,296 | 100,685 | 217,136 | 682,141 | 1,551,142 |
| **All** | **86** | **1,058** | **4,943,499** | **23,418,468** | **1,226,705** | **29,589,730** | **14,655,809** |

## Per agent
| Phase | Task | Model | API calls | Input | Cache write | Cache read | Output | Total | Weighted* |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| Orchestrator (main session) | Planning + coordination | opus 5.5 | 22 | 44 | 227,943 | 3,268,764 | 136,412 | 3,633,163 | 1,293,909 |
| Phase 2 api-facts | cdk-data-edge | sonnet 5.5 | 14 | 28 | 339,699 | 2,485,718 | 22,215 | 2,847,660 | 784,299 |
| Phase 2 api-facts | cdk-compute-network | sonnet 5.5 | 12 | 24 | 254,117 | 1,727,685 | 22,505 | 2,004,331 | 602,964 |
| Phase 2 api-facts | cicd-k6-ops | sonnet 5.5 | 16 | 32 | 211,739 | 1,971,804 | 24,880 | 2,208,455 | 586,286 |
| Phase 5 clarity | clarity 07–12 | haiku 5.5 | 3 | 6 | 92,460 | 27,866 | 58,709 | 179,041 | 411,913 |
| Phase 5 clarity | clarity 13–18 | haiku 5.5 | 3 | 6 | 104,350 | 20,398 | 53,442 | 178,196 | 399,693 |
| Phase 5 clarity | clarity 01–06 | haiku 5.5 | 3 | 6 | 81,803 | 24,754 | 57,733 | 164,296 | 393,400 |
| Phase 5 clarity | clarity 19–23 | haiku 5.5 | 3 | 6 | 85,683 | 27,667 | 47,252 | 160,608 | 346,136 |
| Phase 5 accuracy | accuracy 19–21 | sonnet 5.5 | 6 | 12 | 159,172 | 385,104 | 19,221 | 563,509 | 333,592 |
| Phase 5 re-verify | clarity 13–18 | haiku 5.5 | 5 | 10 | 77,672 | 176,581 | 41,921 | 296,184 | 324,363 |
| Orchestrator (main session) | Planning + coordination | opus 5.5 | 17 | 34 | 73,866 | 1,351,336 | 19,071 | 1,444,307 | 322,855 |
| Phase 5 accuracy | accuracy 10–12 | sonnet 5.5 | 9 | 18 | 120,877 | 706,280 | 17,684 | 844,859 | 310,162 |
| Phase 5 accuracy | accuracy 07–09 | sonnet 5.5 | 8 | 16 | 126,730 | 564,663 | 15,472 | 706,881 | 292,255 |
| Phase 3 content | 17-cicd-deploy | sonnet 5.5 | 6 | 12 | 75,552 | 232,728 | 31,520 | 339,812 | 275,325 |
| Phase 3 content | 21-security-hardening | sonnet 5.5 | 6 | 12 | 73,130 | 229,673 | 31,179 | 333,994 | 270,287 |
| Phase 1 version-notes | deploy-infra notes B | sonnet 5.5 | 7 | 14 | 117,368 | 464,376 | 11,660 | 593,418 | 251,462 |
| Phase 5 accuracy | accuracy 16–18 | sonnet 5.5 | 6 | 12 | 115,530 | 348,745 | 14,011 | 478,298 | 249,354 |
| Phase 3 content | 19-autoscaling-performance | sonnet 5.5 | 7 | 14 | 76,924 | 276,978 | 23,609 | 377,525 | 241,912 |
| Phase 5 re-verify | clarity 07–12 | haiku 5.5 | 3 | 6 | 60,907 | 52,128 | 28,176 | 141,217 | 222,233 |
| Phase 5 accuracy | accuracy 13–15 | sonnet 5.5 | 7 | 14 | 112,334 | 301,222 | 9,474 | 423,044 | 217,924 |
| Phase 3 content | 11-aurora-postgresql | sonnet 5.5 | 5 | 10 | 63,088 | 172,279 | 23,669 | 259,046 | 214,443 |
| Phase 5 accuracy | accuracy 04–06 | sonnet 5.5 | 6 | 12 | 100,647 | 251,348 | 11,512 | 363,519 | 208,516 |
| Phase 5 accuracy | accuracy 22–23 | sonnet 5.5 | 7 | 14 | 86,657 | 360,669 | 11,004 | 458,344 | 199,422 |
| Orchestrator (main session) | Planning + coordination | opus 5.5 | 16 | 32 | 36,942 | 1,213,195 | 5,804 | 1,255,973 | 196,549 |
| Phase 3 content | 10-alb-dns | sonnet 5.5 | 6 | 12 | 61,436 | 215,649 | 17,930 | 295,027 | 188,022 |
| Phase 3 content | 15-cloudfront-frontend | sonnet 5.5 | 4 | 8 | 54,328 | 116,759 | 20,939 | 192,034 | 184,289 |
| Phase 3 content | 22-reliability-dr | sonnet 5.5 | 6 | 12 | 58,560 | 209,308 | 17,924 | 285,804 | 183,763 |
| Phase 3 content | 14-elasticache-valkey | sonnet 5.5 | 4 | 8 | 53,082 | 115,815 | 19,795 | 188,700 | 176,917 |
| Phase 2 api-facts | bun-runtime | sonnet 5.5 | 8 | 16 | 68,339 | 389,401 | 9,431 | 467,187 | 171,535 |
| Phase 3 content | 12-rds-proxy | sonnet 5.5 | 5 | 10 | 52,909 | 157,060 | 17,922 | 227,901 | 171,462 |
| Phase 3 content | 08-vpc-networking | sonnet 5.5 | 6 | 12 | 57,099 | 211,269 | 15,544 | 283,924 | 170,233 |
| Phase 3 content | 05-docker-containers | sonnet 5.5 | 4 | 8 | 51,504 | 114,050 | 18,519 | 184,081 | 168,388 |
| Phase 3 content | 23-cost-operations | sonnet 5.5 | 4 | 8 | 50,837 | 112,488 | 18,632 | 181,965 | 167,963 |
| Phase 3 content | 07-aws-cdk-basics | sonnet 5.5 | 4 | 8 | 55,887 | 105,521 | 17,426 | 178,842 | 167,549 |
| Phase 3 content | 18-observability | sonnet 5.5 | 4 | 8 | 52,394 | 116,182 | 18,052 | 186,636 | 167,379 |
| Phase 3 content | 09-ecs-fargate | sonnet 5.5 | 4 | 8 | 51,595 | 114,395 | 18,241 | 184,239 | 167,146 |
| Phase 3 content | 13-database-migrations | sonnet 5.5 | 4 | 8 | 55,654 | 105,603 | 16,879 | 178,144 | 164,531 |
| Phase 3 content | 16-github-actions-ci | sonnet 5.5 | 6 | 12 | 53,607 | 202,014 | 14,853 | 270,486 | 161,487 |
| Phase 3 content | 06-app-production-readiness | sonnet 5.5 | 4 | 8 | 49,524 | 111,875 | 16,734 | 178,141 | 156,771 |
| Phase 3 content | 20-load-testing-k6 | sonnet 5.5 | 4 | 8 | 48,726 | 110,254 | 16,645 | 175,633 | 155,166 |
| Phase 5 re-verify | clarity 19–23 | haiku 5.5 | 5 | 10 | 48,517 | 130,898 | 15,811 | 195,236 | 152,801 |
| Phase 1 version-notes | deploy-infra notes A | sonnet 5.5 | 5 | 10 | 64,837 | 202,163 | 7,977 | 274,987 | 141,158 |
| Phase 3 content | 01-deployment-foundations | sonnet 5.5 | 4 | 8 | 49,740 | 99,588 | 11,180 | 160,516 | 128,042 |
| Phase 3 content | 02-linux-networking-basics | sonnet 5.5 | 4 | 8 | 43,961 | 105,531 | 11,952 | 161,452 | 125,272 |
| Phase 3 content | 03-aws-fundamentals | sonnet 5.5 | 4 | 8 | 43,225 | 104,105 | 11,137 | 158,475 | 120,135 |
| Phase 5 accuracy | accuracy 01–03 | sonnet 5.5 | 4 | 8 | 62,433 | 72,755 | 6,583 | 141,779 | 118,240 |
| Phase 5 re-verify | clarity 01–06 | haiku 5.5 | 3 | 6 | 32,580 | 40,805 | 14,631 | 88,022 | 117,967 |
| Phase 3 content | 04-aws-multi-account | sonnet 5.5 | 4 | 8 | 42,403 | 103,911 | 10,456 | 156,778 | 115,683 |
| Phase 1 version | deploy-infra versions B | haiku 5.5 | 5 | 10 | 52,452 | 253,725 | 3,308 | 309,495 | 107,488 |
| Phase 5 fix | 14-elasticache-valkey r1 | haiku 5.5 | 16 | 34 | 27,472 | 291,055 | 8,188 | 326,749 | 104,420 |
| Phase 5 fix | 08-vpc-networking r1 | haiku 5.5 | 9 | 18 | 32,847 | 193,742 | 6,403 | 233,010 | 92,466 |
| Phase 5 fix | 18-observability r1 | haiku 5.5 | 6 | 12 | 24,039 | 97,245 | 9,238 | 130,534 | 85,975 |
| Phase 1 version | deploy-infra versions A | haiku 5.5 | 3 | 6 | 50,066 | 90,005 | 2,205 | 142,282 | 82,614 |
| Phase 5 fix | 09-ecs-fargate r1 | sonnet 5.5 | 5 | 10 | 31,225 | 102,676 | 5,420 | 139,331 | 76,409 |
| Phase 5 fix | 17-cicd-deploy r1 | sonnet 5.5 | 11 | 22 | 17,895 | 193,377 | 5,458 | 216,752 | 69,018 |
| Phase 5 re-verify | accuracy 22–23 | sonnet 5.5 | 3 | 6 | 42,468 | 33,723 | 2,474 | 78,671 | 68,833 |
| Phase 5 fix | 12-rds-proxy r1 | sonnet 5.5 | 5 | 10 | 25,613 | 90,624 | 4,809 | 121,056 | 65,134 |
| Phase 5 fix | 11-aurora-postgresql r1 | haiku 5.5 | 5 | 10 | 18,579 | 74,360 | 5,968 | 98,917 | 60,510 |
| Phase 5 fix | 23-cost-operations r1 | sonnet 5.5 | 7 | 14 | 19,123 | 116,918 | 4,943 | 140,998 | 60,325 |
| Phase 5 fix | 16-github-actions-ci r1 | sonnet 5.5 | 8 | 16 | 19,427 | 132,285 | 3,897 | 155,625 | 57,013 |
| Phase 5 fix | 02-linux-networking-basics r1 | haiku 5.5 | 7 | 14 | 16,937 | 104,552 | 5,019 | 126,522 | 56,735 |
| Phase 5 fix | 13-database-migrations r1 | sonnet 5.5 | 4 | 8 | 26,121 | 48,937 | 3,088 | 78,154 | 52,993 |
| Phase 5 fix | 01-deployment-foundations r1 | haiku 5.5 | 6 | 12 | 22,238 | 81,484 | 3,241 | 106,975 | 52,163 |
| Phase 5 fix | 03-aws-fundamentals r1 | sonnet 5.5 | 6 | 12 | 21,621 | 80,411 | 3,246 | 105,290 | 51,309 |
| Phase 5 re-verify | accuracy 07–10 | sonnet 5.5 | 5 | 10 | 26,150 | 80,700 | 2,070 | 108,930 | 51,118 |
| Phase 5 re-verify | accuracy 13–16 | sonnet 5.5 | 5 | 10 | 24,299 | 71,454 | 2,315 | 98,078 | 49,104 |
| Phase 5 fix | 22-reliability-dr r1 | sonnet 5.5 | 8 | 16 | 15,200 | 119,180 | 3,309 | 137,705 | 47,479 |
| Phase 5 fix | 15-cloudfront-frontend r1 | sonnet 5.5 | 5 | 10 | 17,744 | 75,233 | 3,462 | 96,449 | 47,023 |
| Phase 5 fix | 21-security-hardening r1 | sonnet 5.5 | 4 | 8 | 18,115 | 52,055 | 3,715 | 73,893 | 46,432 |
| Phase 5 fix | 19-autoscaling-performance r1 | sonnet 5.5 | 6 | 12 | 17,627 | 74,167 | 2,477 | 94,283 | 41,847 |
| Phase 5 fix | 05-docker-containers r1 | sonnet 5.5 | 6 | 12 | 14,042 | 84,231 | 3,148 | 101,433 | 41,728 |
| Phase 5 fix | 20-load-testing-k6 r1 | sonnet 5.5 | 6 | 12 | 12,914 | 78,434 | 3,372 | 94,732 | 40,858 |
| Phase 5 re-verify | accuracy 19–21 | sonnet 5.5 | 5 | 10 | 15,519 | 68,334 | 2,474 | 86,337 | 38,612 |
| Phase 5 re-verify | accuracy 17-cicd-deploy | sonnet 5.5 | 3 | 6 | 24,262 | 28,537 | 887 | 53,692 | 37,622 |
| Phase 5 fix | 07-aws-cdk-basics r1 | sonnet 5.5 | 5 | 10 | 17,423 | 58,798 | 1,489 | 77,720 | 35,114 |
| Phase 5 fix | 06-app-production-readiness r1 | sonnet 5.5 | 5 | 10 | 12,322 | 64,640 | 2,610 | 79,582 | 34,927 |
| Phase 5 fix | 10-alb-dns r1 | sonnet 5.5 | 5 | 10 | 14,100 | 68,928 | 2,022 | 85,060 | 34,638 |
| Phase 5 re-verify | accuracy 12-rds-proxy | sonnet 5.5 | 3 | 6 | 22,549 | 28,135 | 704 | 51,394 | 34,526 |
| Phase 5 fix | 12-rds-proxy r2 | haiku 5.5 | 4 | 8 | 13,151 | 47,368 | 2,243 | 62,770 | 32,399 |
| Phase 5 re-verify | accuracy 03–06 | sonnet 5.5 | 4 | 8 | 12,039 | 45,243 | 1,777 | 59,067 | 28,466 |
| Phase 5 re-verify | accuracy 19–23 | sonnet 5.5 | 5 | 10 | 11,096 | 57,437 | 1,202 | 69,745 | 25,634 |
| Phase 5 re-verify | clarity 12-rds-proxy | haiku 5.5 | 4 | 8 | 8,880 | 36,292 | 1,666 | 46,846 | 23,067 |
| Phase 5 fix | 23-cost-operations r2 | sonnet 5.5 | 5 | 10 | 8,833 | 57,672 | 992 | 67,507 | 21,778 |
| Phase 5 fix | 22-reliability-dr r2 | sonnet 5.5 | 5 | 10 | 8,552 | 57,097 | 926 | 66,585 | 21,040 |
| Phase 5 fix | 04-aws-multi-account r1 | haiku 5.5 | 4 | 8 | 8,996 | 43,553 | 978 | 53,535 | 20,498 |
| Phase 5 fix | 19-autoscaling-performance r2 | sonnet 5.5 | 5 | 10 | 8,580 | 56,540 | 807 | 65,937 | 20,424 |
| Phase 5 fix | 17-cicd-deploy r2 | sonnet 5.5 | 4 | 8 | 8,832 | 43,451 | 998 | 53,289 | 20,383 |
| Phase 5 re-verify | clarity 17-cicd-deploy | haiku 5.5 | 2 | 4 | 8,074 | 12,706 | 475 | 21,259 | 13,742 |
| Phase 5 re-verify | accuracy 17-cicd-deploy | sonnet 5.5 | 2 | 4 | 7,710 | 13,804 | 354 | 21,872 | 12,792 |

## Notes
- Subagents: 86, 23,256,287 tokens (weighted 12,842,496). Main session: 6,333,443 tokens (weighted 1,813,313), 92.1% cache reads.
- Dollar cost not computed; run `/cost` in Claude Code.
