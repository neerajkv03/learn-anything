# 15. CloudFront & Frontend Delivery
Version: Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2
Prerequisites: 05-docker-containers, 10-alb-dns

Design: one distribution for `www.example.com`. Behaviours: default `*` → ALB origin (SSR web), `/api/*` → same ALB origin (no caching), `/assets/*` → S3 (hashed build assets, long cache). ALB origin = `origin.example.com` via `origins.HttpOrigin` with HTTPS_ONLY (cert matches that name — topic 10); `LoadBalancerV2Origin` exists but connects to the ALB's AWS DNS name, which the origin certificate doesn't cover — mention. CDK 2.273+ default behaviours redirect HTTP→HTTPS. Region us-east-1 so certificate is already in the required region. Asset folder: Vite default `assets/` inside the client build output (exact output path depends on build setup — tell learner to check).

## Learning goals
- Learner can explain what a CDN does and how cache keys/TTLs decide hits.
- Learner can put CloudFront in front of the ALB for SSR and API.
- Learner can serve static assets from a private S3 bucket via OAC.
- Learner can choose cache and origin request policies per behaviour.
- Learner can deploy new assets without breaking users and invalidate only when needed.

## Sub-topics
### What a CDN does
- Concept: CloudFront = network of edge locations near users; caches responses, terminates TLS close to user, keeps warm connections to origin, absorbs traffic spikes and DDoS (Shield Standard, topic 21). Cache key = what makes two requests "the same" (path + chosen headers/cookies/query). Hit = served from edge, origin untouched.
- Analogy: local convenience stores stocked from a central warehouse: shoppers buy nearby; only items not on the shelf trigger a truck from the warehouse (origin).
- Code example: `curl -sI https://www.example.com/assets/index-3f2a1c9.js | grep -i x-cache` → first `x-cache: Miss from cloudfront`, repeat → `x-cache: Hit from cloudfront`.
- Production use: at 250K RPS most static and cacheable traffic never reaches the ALB.
- Common mistakes: putting cookies/all headers in the cache key (hit ratio ~0); caching personalised pages publicly; no CDN for static files.
- Sources: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html ; https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/understanding-the-cache-key.html

### CloudFront with ALB origin for SSR
- Concept: `new origins.HttpOrigin("origin.example.com", { protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY, customHeaders: { "X-Origin-Verify": originSecret } })`; ALB must be internetFacing. Lock ALB to CloudFront: ALB HTTPS listener default action = fixed 403; rules forward only when header `X-Origin-Verify` matches (ListenerCondition.httpHeader). readTimeout default 30 s (max 120 without quota increase). Secret value from a generated Secrets Manager secret.
- Analogy: the warehouse only opens its loading dock for trucks showing the company's secret pass; random vans get turned away.
- Code example: ALB side (update topic 10): `https.addAction("ApiFromCf", { priority: 10, conditions: [elbv2.ListenerCondition.httpHeader("X-Origin-Verify", [originSecret]), elbv2.ListenerCondition.pathPatterns(["/api/*"])], action: elbv2.ListenerAction.forward([apiTg]) }); https.addAction("WebFromCf", { priority: 20, conditions: [elbv2.ListenerCondition.httpHeader("X-Origin-Verify", [originSecret])], action: elbv2.ListenerAction.forward([webTg]) });` with listener `defaultAction: elbv2.ListenerAction.fixedResponse(403, { contentType: "text/plain", messageBody: "forbidden" })`. Expected: `curl -s https://origin.example.com/` → `forbidden`; `curl -s -o /dev/null -w "%{http_code}\n" https://www.example.com/` → `200`.
- Production use: no bypass of CloudFront/WAF.
- Common mistakes: ALB still publicly reachable without the header check; HTTP between CloudFront and origin across the internet; readTimeout too low for slow SSR.
- Sources: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/restrict-access-to-load-balancer.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront_origins.HttpOrigin.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront_origins.LoadBalancerV2OriginProps.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_elasticloadbalancingv2.ListenerCondition.html

### S3 static assets with origin access control
- Concept: private bucket (BLOCK_ALL public access); `origins.S3BucketOrigin.withOriginAccessControl(bucket)` → CloudFront signs requests, bucket policy allows only this distribution (OAI is legacy). Upload with `s3deploy.BucketDeployment` (prune default true → set false so old hashed files stay for users with old HTML).
- Analogy: a stockroom with no public door; only the store's own staff entrance (OAC) can fetch from it.
- Code example: `const assets = new s3.Bucket(this, "WebAssets", { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, enforceSSL: true }); new s3deploy.BucketDeployment(this, "DeployAssets", { sources: [s3deploy.Source.asset("../web/<client-build-dir>/assets")], destinationBucket: assets, destinationKeyPrefix: "assets/", prune: false });` Expected: `curl -s -o /dev/null -w "%{http_code}\n" https://<bucket>.s3.amazonaws.com/assets/index-3f2a1c9.js` → `403`; via `https://www.example.com/assets/index-3f2a1c9.js` → `200`.
- Production use: JS/CSS/images served from edge, not Bun tasks.
- Common mistakes: public bucket; prune true deleting assets still referenced by cached HTML (broken pages after deploy); wrong destinationKeyPrefix vs path pattern.
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront_origins.S3BucketOrigin.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_s3_deployment.BucketDeploymentProps.html ; https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html

### Cache policies and behaviours
- Concept: behaviour = path pattern → origin + cache policy + origin request policy + viewer protocol policy. Managed: CACHING_OPTIMIZED (no cookies/query in key, gzip/br normalised) for `/assets/*`; CACHING_DISABLED for `/api/*` and personalised SSR; origin request policy ALL_VIEWER_EXCEPT_HOST_HEADER forwards cookies/query/headers to ALB without breaking Host for the origin cert. Optional custom policy for public SSR pages: defaultTtl 60 s, min 0, max 1 day; app sends `Cache-Control: public, max-age=60` only on anonymous pages.
- Analogy: different shelves with different rules: tinned goods (hashed assets) stay for a year; fresh bread (public pages) one minute; made-to-order meals (API, logged-in pages) never pre-made.
- Code example: `new cloudfront.Distribution(this, "Cdn", { domainNames: ["www.example.com"], certificate: wwwCert, webAclId: webAcl.attrArn, defaultBehavior: { origin: albOrigin, cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER, viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL }, additionalBehaviors: { "/api/*": { origin: albOrigin, cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER, viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY, allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL }, "/assets/*": { origin: origins.S3BucketOrigin.withOriginAccessControl(assets), cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED, viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS } } });` + Route 53 alias `www` → `new targets.CloudFrontTarget(distribution)`. webAclId explained in topic 21.
- Production use: the shop's whole front door.
- Common mistakes: forgetting ALLOW_ALL methods on /api (POST blocked); forwarding Host header to ALB origin (TLS name mismatch); caching Set-Cookie responses.
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront.DistributionProps.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront.CachePolicy.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront.OriginRequestPolicy.html ; https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html

### Invalidations on deploy
- Concept: AWS recommends versioned (hashed) file names over invalidations (cheaper, no lag). Vite outputs hashed asset names → no invalidation needed for assets. Invalidate only cached HTML/public pages if their TTL is long; first 1,000 paths/month free; wildcard `/*` counts as one path. BucketDeployment `distribution` + `distributionPaths` can invalidate automatically (default none).
- Analogy: printing a new edition with a new ISBN instead of recalling every copy of the old book from every shop.
- Code example: `aws cloudfront create-invalidation --distribution-id E1ABCDEF2GHIJ --paths "/" "/products/*"` → JSON with `"Status": "InProgress"`; `aws cloudfront wait invalidation-completed --distribution-id E1ABCDEF2GHIJ --id <Id>` returns when done.
- Production use: pipeline step only when public page TTL > a few minutes.
- Common mistakes: invalidating `/*` on every deploy as a habit (masks caching bugs); non-hashed `app.js` cached for a year; expecting instant global effect.
- Sources: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html#Invalidation_Expiration ; https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/PayingForInvalidation.html ; https://docs.aws.amazon.com/cli/latest/reference/cloudfront/create-invalidation.html

## Quiz
1. Why CACHING_DISABLED on /api/* but CACHING_OPTIMIZED on /assets/*? — tests policies.
2. Someone curls origin.example.com directly. What should they get and why? — tests origin lock.
3. Why prune: false for asset uploads? — tests old hashed assets.
4. Do hashed asset names need invalidation after deploy? — tests versioned names.
5. Why HttpOrigin with origin.example.com instead of the ALB DNS name over HTTPS? — tests origin TLS.
