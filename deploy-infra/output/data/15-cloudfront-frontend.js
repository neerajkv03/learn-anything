window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "15-cloudfront-frontend",
  "order": 15,
  "title": "CloudFront & Frontend Delivery",
  "version": "Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2",
  "summary": "Put Amazon CloudFront, AWS's content delivery network (CDN), in front of your load balancer so that one public address, www.example.com, serves server-rendered pages, the API and static files. You will lock the load balancer so only CloudFront can reach it, serve build files from a private S3 bucket, pick a cache policy (the rules that decide which requests share a saved copy) per URL pattern, and ship new frontend versions without mass invalidations (forced removals of saved copies).",
  "prerequisites": ["05-docker-containers", "10-alb-dns"],
  "subtopics": [
    {
      "id": "what-a-cdn-does",
      "title": "What a CDN does",
      "explanation": "A CDN (content delivery network) is a worldwide set of servers that sit between your users and your own servers. Amazon CloudFront is AWS's CDN. Its servers are called edge locations: data-centre sites placed close to users in many cities. Your own server, the one that creates the real answer, is called the origin. In this course the origin is the load balancer (ALB) from topic 10.\n\nWhen a user asks for a URL, the request goes to a nearby edge location first. If that edge already holds a saved copy of the answer, it replies immediately. This is a cache hit, and your origin never sees the request. If it has no copy, it is a cache miss: the edge fetches the answer from the origin, replies to the user, and keeps a copy for next time. A cache is simply a place that stores copies of answers so they do not have to be produced again.\n\nHow does the edge decide that two requests want the same answer? It builds a cache key, a short identity made from the request. The key always contains the URL path (for example /assets/app.js) and the domain. A cache policy decides whether more things join the key: certain query-string parts (the ?a=1 part of a URL), certain headers, certain cookies (a cookie is a small piece of data the browser stores and sends back with each request, often used to remember a logged-in user). The fewer things in the key, the more requests share one saved copy. If you put a cookie that is different for every user in the key, every user gets their own copy and almost nothing is ever a hit.\n\nHow long does a saved copy stay valid? That is its TTL (time to live, the number of seconds before the copy is considered stale; you met TTL for DNS in topic 2). The origin can state it with a Cache-Control response header, for example Cache-Control: public, max-age=60, which means any cache may keep this answer for 60 seconds. After that the edge fetches a fresh copy.\n\nA CDN also helps even for answers it cannot cache. The edge terminates TLS (completes the secure HTTPS handshake) close to the user, so the slow back-and-forth happens over a short distance. It then reuses long-lived warm connections to the origin instead of opening a new one per request. And because traffic lands on many edge locations, spikes and attacks are spread out; AWS Shield Standard, which protects CloudFront against common network-level DDoS attacks (floods of fake traffic), is covered in topic 21.\n\nYou can see hits and misses yourself. CloudFront adds an x-cache response header. The first request for a file shows Miss from cloudfront, a repeat shows Hit from cloudfront.",
      "analogy": "Think of local convenience stores supplied from one central warehouse. Shoppers buy from the shelf of the store near them (edge location). Only when an item is not on the shelf does the store send a truck to the warehouse (origin) and then keep the extra stock for the next shopper. The shelf label saying how long the item is fresh is the TTL.",
      "code": [
        {
          "language": "bash",
          "filename": "check-cache.sh",
          "source": "# Replace the file name with a real file from your build output.\n# -s = silent, -I = send a HEAD request and print only the response headers.\ncurl -sI https://www.example.com/assets/index-3f2a1c9.js | grep -i x-cache\ncurl -sI https://www.example.com/assets/index-3f2a1c9.js | grep -i x-cache",
          "output": "x-cache: Miss from cloudfront\nx-cache: Hit from cloudfront",
          "explanation": "The same file is requested twice. The first request reaches the edge with nothing saved, so the edge goes to the origin (Miss). The second request is answered from the edge copy (Hit). The first line may already say Hit if another visitor requested the file earlier through the same edge location. The grep -i part just keeps the line that contains x-cache, ignoring upper or lower case."
        }
      ],
      "productionNote": "At 250K requests per second (RPS), most static and cacheable traffic should never reach the ALB. Every hit is a request your Fargate tasks do not have to serve, so a CDN is one of the cheapest ways to add headroom. Watch the cache hit ratio (hits divided by all requests) per behavior from topic 18's dashboards; a sudden drop usually means someone added a header or cookie to the cache key.",
      "commonMistakes": [
        "Putting cookies or all headers in the cache key. Each user then has a unique key, the hit ratio falls to about zero and the CDN only adds a hop.",
        "Letting the CDN cache personalised pages (pages that differ per logged-in user) publicly. One user's page can then be served to another. Pages with user data must never be cacheable.",
        "Serving static files (JavaScript, CSS, images) from your application servers with no CDN in front. Those files are the easiest requests to cache."
      ],
      "sources": [
        { "title": "What is Amazon CloudFront? (Developer Guide)", "url": "https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html" },
        { "title": "Understand the cache key", "url": "https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/understanding-the-cache-key.html" }
      ]
    },
    {
      "id": "cloudfront-alb-origin",
      "title": "CloudFront with an ALB origin for SSR",
      "explanation": "SSR (server-side rendering) means your server builds the HTML page for each request; in this course that server is the TanStack Start web app running as a Fargate service behind the ALB. We now make CloudFront the only public way in. The plan has one distribution (a CloudFront configuration with its own domain) for www.example.com, with the ALB as the origin for both pages and the /api/* paths.\n\nIn the CDK (the infrastructure-as-code library from topic 7), the origin is created with origins.HttpOrigin, which takes a domain name. Use origin.example.com, the DNS name from topic 10 that points at the ALB and is covered by the ALB's certificate. Set protocolPolicy to HTTPS_ONLY so CloudFront always talks to the ALB over TLS. The ALB must be internet-facing, because CloudFront reaches it over the public internet.\n\nThere is also origins.LoadBalancerV2Origin, which takes the load balancer object directly. It connects using the ALB's AWS-generated DNS name (something like my-alb-123.us-east-1.elb.amazonaws.com). Your certificate covers origin.example.com, not that name, so with HTTPS the names would not match and the TLS handshake fails. That is why this course uses HttpOrigin with your own name.\n\nProblem: the ALB is still public, so anyone could call origin.example.com directly and skip CloudFront, including any firewall you add there later (topic 21). The fix is a shared secret. CloudFront adds a custom header, X-Origin-Verify, with a long random value to every request it sends to the origin. The ALB's HTTPS listener (topic 10) gets a default action that returns a fixed 403 response (HTTP status 403 means forbidden), and your forwarding rules only match requests that carry the right header value. Rules run in priority order, lowest number first, so the narrower /api/* rule has priority 10 and the catch-all web rule 20.\n\nThe secret itself is generated by AWS Secrets Manager (topic 9), so it never appears in your source code. Calling unsafeUnwrap() on the secret's value is named that way as a warning: it hands you the value for use in a template. At deploy time CloudFormation resolves it with a dynamic reference. The value is still visible to anyone allowed to read the distribution's configuration, so treat it as a lock, not a vault.\n\nFirst the ALB side, as a small construct that you create in the same stack as the listener from topic 10. That listener was created with defaultAction: elbv2.ListenerAction.fixedResponse(403, { contentType: 'text/plain', messageBody: 'forbidden' }). Remove any older rule that forwards traffic without checking the header, otherwise it keeps the bypass open.",
      "analogy": "The warehouse (ALB) only opens its loading dock to trucks showing the company's secret pass (the X-Origin-Verify header). Delivery trucks from the company's own stores (CloudFront) show it and are loaded. Random vans arriving at the dock are turned away with 'forbidden', however politely they ask.",
      "code": [
        {
          "language": "typescript",
          "filename": "origin-lock.ts",
          "source": "import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';\nimport * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';\nimport { Construct } from 'constructs';\n\ninterface OriginLockProps {\n  https: elbv2.ApplicationListener; // HTTPS listener from topic 10, defaultAction = fixed 403\n  webTg: elbv2.ApplicationTargetGroup; // SSR web service\n  apiTg: elbv2.ApplicationTargetGroup; // API service\n}\n\nexport class OriginLock extends Construct {\n  public readonly secret: secretsmanager.Secret;\n\n  constructor(scope: Construct, id: string, props: OriginLockProps) {\n    super(scope, id);\n\n    // Secrets Manager generates a 32-character random value; no punctuation keeps it header-safe.\n    this.secret = new secretsmanager.Secret(this, 'OriginSecret', {\n      generateSecretString: { excludePunctuation: true, passwordLength: 32 },\n    });\n    const headerValue = this.secret.secretValue.unsafeUnwrap();\n\n    props.https.addAction('ApiFromCf', {\n      priority: 10,\n      conditions: [\n        elbv2.ListenerCondition.httpHeader('X-Origin-Verify', [headerValue]),\n        elbv2.ListenerCondition.pathPatterns(['/api/*']),\n      ],\n      action: elbv2.ListenerAction.forward([props.apiTg]),\n    });\n\n    props.https.addAction('WebFromCf', {\n      priority: 20,\n      conditions: [elbv2.ListenerCondition.httpHeader('X-Origin-Verify', [headerValue])],\n      action: elbv2.ListenerAction.forward([props.webTg]),\n    });\n  }\n}\n",
          "output": "",
          "explanation": "Nothing is printed; this file only defines infrastructure. Both rules require the secret header. ApiFromCf (priority 10) additionally requires a path starting with /api/ and sends it to the API target group. WebFromCf (priority 20) sends every other request that carries the header to the web target group. A request without the header matches no rule and receives the listener's default fixed 403."
        },
        {
          "language": "typescript",
          "filename": "alb-origin.ts",
          "source": "import * as cdk from 'aws-cdk-lib';\nimport * as cloudfront from 'aws-cdk-lib/aws-cloudfront';\nimport * as origins from 'aws-cdk-lib/aws-cloudfront-origins';\nimport * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';\n\nexport function albOrigin(originSecret: secretsmanager.ISecret): origins.HttpOrigin {\n  return new origins.HttpOrigin('origin.example.com', {\n    protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,\n    readTimeout: cdk.Duration.seconds(60), // default is 30 s; raise only if SSR is genuinely slow\n    customHeaders: { 'X-Origin-Verify': originSecret.secretValue.unsafeUnwrap() },\n  });\n}\n",
          "output": "",
          "explanation": "This helper builds the origin that the distribution in sub-topic 4 uses. readTimeout is how long CloudFront waits for the origin to answer before it gives up and returns an error page; it defaults to 30 seconds. The customHeaders value is the same generated secret the ALB rules compare against."
        },
        {
          "language": "bash",
          "filename": "verify-origin-lock.sh",
          "source": "# Direct to the ALB name: no secret header, so the default action answers.\ncurl -s -w '\\n' https://origin.example.com/\n\n# Through CloudFront: print only the status code (-o /dev/null drops the body).\ncurl -s -o /dev/null -w '%{http_code}\\n' https://www.example.com/",
          "output": "forbidden\n200",
          "explanation": "Calling origin.example.com yourself gets the fixed 403 body forbidden because you do not know the secret. The body has no trailing newline, so -w '\\n' makes curl print one; without it the next output would run on as forbidden200. Calling www.example.com goes through CloudFront, which adds the header, so the page is served with status 200."
        }
      ],
      "productionNote": "With this lock in place nobody can bypass CloudFront (and the web firewall you attach to it in topic 21) by hitting the ALB directly. Rotating the secret later means updating both sides; plan a rollout that briefly accepts both values if you need zero downtime.",
      "commonMistakes": [
        "Leaving the ALB reachable without the header check. Anyone who finds origin.example.com can then skip the CDN and any firewall in front of it.",
        "Using HTTP between CloudFront and the origin. That traffic crosses the public internet unencrypted, including the secret header. Use HTTPS_ONLY.",
        "Setting readTimeout too low for slow server-rendered pages. CloudFront then gives up and users see an error although the origin would have answered.",
        "Using LoadBalancerV2Origin with HTTPS and a certificate for your own name. The connection uses the AWS-generated ALB DNS name, which the certificate does not cover, so TLS fails."
      ],
      "sources": [
        { "title": "Restrict access to Application Load Balancers (CloudFront)", "url": "https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/restrict-access-to-load-balancer.html" },
        { "title": "CDK HttpOrigin", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront_origins.HttpOrigin.html" },
        { "title": "CDK LoadBalancerV2OriginProps", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront_origins.LoadBalancerV2OriginProps.html" }
      ]
    },
    {
      "id": "s3-assets-oac",
      "title": "S3 static assets with origin access control",
      "explanation": "Static assets are the files your frontend build produces once and that never change per user: JavaScript, CSS, images, fonts. Build tools such as Vite put a hash (a short code derived from the file's content) in each file name, for example index-3f2a1c9.js. A changed file gets a new name, so a given name always means the same content.\n\nAmazon S3 (Simple Storage Service) stores files as objects inside a bucket, a named container. Each object has a key, which is its full name including any folder-like prefix, such as assets/index-3f2a1c9.js. We keep these files in a private bucket and let CloudFront read them. That way JavaScript and CSS are served from the edge, not by your Fargate tasks.\n\nPrivate means block all public access: set blockPublicAccess to BLOCK_ALL, and set enforceSSL to true so the bucket refuses plain-HTTP requests. Then use origins.S3BucketOrigin.withOriginAccessControl(bucket). OAC (origin access control) makes CloudFront sign each request it sends to S3 with its own identity, and the CDK adds a bucket policy that allows only this distribution. The older mechanism, OAI (origin access identity), is legacy; use OAC.\n\nUploading is done by s3deploy.BucketDeployment, a CDK construct that copies a local folder into the bucket during cdk deploy. Source.asset(path) points to the folder. Check where your build writes its client files; the path depends on your setup (it depends on the build tool your TanStack Start project uses, for example Rsbuild or Vite with Nitro; the build output names the client folder). Look for the folder named assets inside the client output and use that path. The example uses ../web/dist/client/assets.\n\nTwo settings matter. destinationKeyPrefix: 'assets/' puts every file under the assets/ key prefix, so CloudFront's request path /assets/index-3f2a1c9.js maps to the S3 key assets/index-3f2a1c9.js; the prefix and the behavior path pattern in the next sub-topic must match. And prune: false stops the deployment from deleting files that are no longer in your local folder (the default, true, deletes them). Users who loaded the old HTML a minute ago, or whose browser cached it, still ask for the old hashed files. If you delete them, those pages break.\n\nThe cacheControl option stamps a Cache-Control header (public, max-age=31536000, immutable: any cache may keep it for one year) on every uploaded file. CloudFront honours the origin's Cache-Control within the cache policy's minimum and maximum TTL; with no header it uses the policy's 24-hour default TTL, so without this option the edge would keep the files for only one day.\n\nBecause S3 is private, a direct request to the bucket's own URL must fail, while the same file through CloudFront works.",
      "analogy": "The stockroom has no public door. Only the store's own staff entrance (OAC) opens it, and the lock accepts only staff from this one store (this distribution). Old stock stays on the back shelves (prune: false) because customers holding yesterday's catalogue may still ask for it.",
      "code": [
        {
          "language": "typescript",
          "filename": "web-assets.ts",
          "source": "import * as s3 from 'aws-cdk-lib/aws-s3';\nimport * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';\nimport { Construct } from 'constructs';\n\nexport class WebAssets extends Construct {\n  public readonly bucket: s3.Bucket;\n\n  constructor(scope: Construct, id: string) {\n    super(scope, id);\n\n    this.bucket = new s3.Bucket(this, 'Bucket', {\n      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,\n      enforceSSL: true,\n    });\n\n    new s3deploy.BucketDeployment(this, 'DeployAssets', {\n      // Adjust to your build: the folder named \"assets\" inside the client output.\n      sources: [s3deploy.Source.asset('../web/dist/client/assets')],\n      destinationBucket: this.bucket,\n      destinationKeyPrefix: 'assets/', // key = assets/<file>, matches the /assets/* path\n      prune: false, // keep old hashed files for users with older HTML\n      cacheControl: [s3deploy.CacheControl.fromString('public, max-age=31536000, immutable')],\n    });\n  }\n}\n",
          "output": "",
          "explanation": "The class creates a private bucket and a deployment that uploads the build's assets folder under the assets/ prefix without deleting older files. It prints nothing; cdk deploy performs the upload. The bucket is exposed as a field so the distribution can use it as an origin."
        },
        {
          "language": "bash",
          "filename": "verify-bucket-private.sh",
          "source": "# Direct S3 URL (replace <bucket> with your bucket name): must be refused.\ncurl -s -o /dev/null -w '%{http_code}\\n' https://<bucket>.s3.amazonaws.com/assets/index-3f2a1c9.js\n\n# Through CloudFront: allowed.\ncurl -s -o /dev/null -w '%{http_code}\\n' https://www.example.com/assets/index-3f2a1c9.js",
          "output": "403\n200",
          "explanation": "The bucket answers 403 to anyone but the distribution, while the same object is delivered with 200 through CloudFront. The second command only works after the distribution from the next sub-topic is deployed."
        }
      ],
      "productionNote": "Once assets come from the edge, your Fargate tasks only handle pages and API calls. Old hashed files accumulate in the bucket with prune: false; they are small, and you can add an S3 lifecycle rule (an automatic expiry rule on the bucket) to remove files older than a few months.",
      "commonMistakes": [
        "Making the bucket public so CloudFront can read it. Anyone can then fetch files directly; use BLOCK_ALL plus OAC.",
        "Leaving prune on (true). A new deploy deletes hashed files that cached or already-open pages still reference, so users see broken pages after each release.",
        "A destinationKeyPrefix that does not match the behavior path pattern, for example uploading to static/ but routing /assets/*. CloudFront asks S3 for keys that do not exist and returns errors."
      ],
      "sources": [
        { "title": "CDK S3BucketOrigin", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront_origins.S3BucketOrigin.html" },
        { "title": "CDK BucketDeploymentProps", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_s3_deployment.BucketDeploymentProps.html" },
        { "title": "Restrict access to an Amazon S3 origin (OAC)", "url": "https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html" }
      ]
    },
    {
      "id": "cache-policies-behaviors",
      "title": "Cache policies and behaviors",
      "explanation": "A cache behavior ties a URL path pattern to what CloudFront does with matching requests: which origin to use, which cache policy, which origin request policy, and which viewer protocol policy. The default behavior (pattern *) catches everything not matched by another pattern. Extra patterns such as /api/* and /assets/* are checked first.\n\nA cache policy decides the cache key and the TTLs. CloudFront ships managed (ready-made) ones. CACHING_OPTIMIZED puts no cookies or query strings in the key, normalises compression support (gzip and brotli, two ways of shrinking files) and caches for 24 hours by default, up to a year if the origin's Cache-Control header says so; use it for /assets/*. CACHING_DISABLED turns caching off completely; use it for /api/* and for server-rendered pages that can differ per user.\n\nAn origin request policy decides what CloudFront forwards to the origin on a miss, separately from the cache key. Use the managed ALL_VIEWER_EXCEPT_HOST_HEADER for the ALB: it forwards the user's cookies, query string and headers (the app needs them, for example the login cookie) but not the Host header. If CloudFront forwarded Host: www.example.com to an origin it connects to as origin.example.com, the names would disagree and TLS or routing would break.\n\nThe viewer protocol policy controls what happens when a user connects with plain HTTP. REDIRECT_TO_HTTPS answers with a redirect to the HTTPS URL; HTTPS_ONLY rejects HTTP. Since CDK 2.273.0 the default behavior redirects HTTP to HTTPS on its own, but writing it explicitly keeps the intent obvious. For /api/* we choose HTTPS_ONLY, because an API client that sends data over HTTP should fail loudly instead of being quietly redirected after its data was already exposed.\n\nBy default CloudFront only passes GET and HEAD requests. Set allowedMethods to ALLOW_ALL on behaviors that go to the app, otherwise a POST (sending data) never reaches your server.\n\nThe code below creates the distribution and the DNS record. It uses a certificate for www.example.com that must live in us-east-1: CloudFront only accepts certificates from that region, and this course already runs in us-east-1, so the certificate from topic 10 qualifies. The Route 53 alias record (topic 10) named www points to the distribution. Attaching a web firewall (the webAclId option) is added in topic 21.\n\nOptional step for public pages that are identical for every visitor: create your own cache policy with defaultTtl 60 seconds, minTtl 0 and maxTtl 1 day, and have the app send Cache-Control: public, max-age=60 only on anonymous pages. The edge then keeps those pages for a minute and the origin sees at most one request per minute per edge location. Never send that header on logged-in pages.",
      "analogy": "A shop with different shelves and rules. Tinned goods (hashed assets) stay on the shelf for a year. Fresh bread (public pages) is replaced every minute. Made-to-order meals (API calls and logged-in pages) are never pre-made; every order goes to the kitchen.",
      "code": [
        {
          "language": "typescript",
          "filename": "frontend-stack.ts",
          "source": "import * as cdk from 'aws-cdk-lib';\nimport * as acm from 'aws-cdk-lib/aws-certificatemanager';\nimport * as cloudfront from 'aws-cdk-lib/aws-cloudfront';\nimport * as origins from 'aws-cdk-lib/aws-cloudfront-origins';\nimport * as route53 from 'aws-cdk-lib/aws-route53';\nimport * as targets from 'aws-cdk-lib/aws-route53-targets';\nimport * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';\nimport { Construct } from 'constructs';\nimport { albOrigin } from './alb-origin';\nimport { WebAssets } from './web-assets';\n\ninterface FrontendProps extends cdk.StackProps {\n  originSecret: secretsmanager.ISecret; // OriginLock.secret\n  wwwCert: acm.ICertificate; // certificate for www.example.com, in us-east-1\n  zone: route53.IHostedZone; // hosted zone for example.com\n}\n\nexport class FrontendStack extends cdk.Stack {\n  constructor(scope: Construct, id: string, props: FrontendProps) {\n    super(scope, id, props);\n\n    const assets = new WebAssets(this, 'WebAssets');\n\n    // Shared settings for everything that goes to the app behind the ALB.\n    const toApp: cloudfront.BehaviorOptions = {\n      origin: albOrigin(props.originSecret),\n      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,\n      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,\n      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,\n      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,\n    };\n\n    const distribution = new cloudfront.Distribution(this, 'Cdn', {\n      domainNames: ['www.example.com'],\n      certificate: props.wwwCert,\n      defaultBehavior: toApp,\n      additionalBehaviors: {\n        '/api/*': {\n          ...toApp,\n          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,\n        },\n        '/assets/*': {\n          origin: origins.S3BucketOrigin.withOriginAccessControl(assets.bucket),\n          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,\n          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,\n        },\n      },\n    });\n\n    new route53.ARecord(this, 'WwwAlias', {\n      zone: props.zone,\n      recordName: 'www',\n      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),\n    });\n  }\n}\n",
          "output": "",
          "explanation": "toApp holds the settings shared by the default behavior and /api/*, and /api/* overrides only the protocol policy with the spread syntax (...toApp copies all its fields). Both use CACHING_DISABLED, forward viewer data except Host, and allow all HTTP methods. /assets/* reads from the private S3 bucket through OAC and uses CACHING_OPTIMIZED; it keeps the default GET and HEAD methods, which is all static files need. The last block creates the www alias record that points to the distribution."
        }
      ],
      "productionNote": "This distribution is the front door of the whole shop: one domain, three behaviors, and the ALB closed to everyone else. Start with caching disabled for pages, measure, and enable a short TTL only for pages you know are identical for all visitors.",
      "commonMistakes": [
        "Forgetting ALLOW_ALL on the app behaviors. POST, PUT and DELETE requests are then rejected by CloudFront and never reach the API.",
        "Forwarding the viewer's Host header to the ALB origin. The origin is contacted as origin.example.com, so a different Host breaks the TLS name match or routing. Use ALL_VIEWER_EXCEPT_HOST_HEADER.",
        "Caching responses that set cookies (a Set-Cookie header, the response header that tells the browser to store a cookie). The cookie, often a login session, can be handed to other visitors."
      ],
      "sources": [
        { "title": "CDK DistributionProps", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront.DistributionProps.html" },
        { "title": "CDK CachePolicy", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront.CachePolicy.html" },
        { "title": "CDK OriginRequestPolicy", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront.OriginRequestPolicy.html" }
      ]
    },
    {
      "id": "invalidations-on-deploy",
      "title": "Deploying new assets and invalidating only when needed",
      "explanation": "An invalidation is a request that tells CloudFront to drop saved copies of some paths before their TTL runs out. It takes some time to reach all edge locations, so it is not instant. AWS recommends versioned file names over invalidations: cheaper and without any waiting.\n\nThe frontend build already gives you versioned names. A new release produces index-9d8e7f1.js next to the old index-3f2a1c9.js. The new HTML points at the new name, which no edge has cached yet, so it is fetched fresh. The old file stays cached and in S3 (prune: false), so pages that still use it keep working. Hashed assets therefore never need invalidation, and you can give them a one-year TTL safely.\n\nThe things that do keep one name are the HTML pages. If you cache public pages with a long TTL, users may see old HTML pointing at old assets for that long. For short TTLs such as 60 seconds, just wait. Invalidate only if the TTL is more than a few minutes and the change cannot wait. The first 1,000 invalidation paths per month are free; after that each path costs a small fee. A wildcard path such as /* counts as one path, but making it a habit hides caching mistakes and throws away the whole cache, so the next minutes send full traffic to your origin.\n\nYou can run an invalidation from the AWS CLI with aws cloudfront create-invalidation, giving the distribution ID and the paths. The output shows Status InProgress. The command aws cloudfront wait invalidation-completed blocks until it finishes; it needs the invalidation Id from the first command.\n\nIf you would rather let CDK do it, BucketDeployment accepts a distribution and a list distributionPaths; after uploading, it invalidates those paths. Without those two options nothing is invalidated. Because the deployment then needs the distribution object, it has to be created after the distribution in your code.",
      "analogy": "When a publisher prints a new edition with a new ISBN, nobody has to recall the old books from every shop. Shops start stocking the new edition, and readers holding the old one can still read it. Recalling every copy (an invalidation) is only for the rare case where the same ISBN must change.",
      "code": [
        {
          "language": "bash",
          "filename": "invalidate.sh",
          "source": "# Drop cached copies of the home page and everything under /products/.\naws cloudfront create-invalidation --distribution-id E1ABCDEF2GHIJ --paths \"/\" \"/products/*\"\n\n# Wait until it has finished (use the Id printed above).\naws cloudfront wait invalidation-completed --distribution-id E1ABCDEF2GHIJ --id I2J3K4L5M6N7O8",
          "output": "{\n    \"Location\": \"https://cloudfront.amazonaws.com/2020-05-31/distribution/E1ABCDEF2GHIJ/invalidation/I2J3K4L5M6N7O8\",\n    \"Invalidation\": {\n        \"Id\": \"I2J3K4L5M6N7O8\",\n        \"Status\": \"InProgress\",\n        ...\n    }\n}",
          "explanation": "The first command starts the invalidation and prints JSON (shortened here; the real output also has CreateTime and the list of paths). Status InProgress means CloudFront is still working on it. The second command prints nothing and returns when the status becomes Completed. The distribution ID and invalidation Id above are example values; use your own."
        }
      ],
      "productionNote": "Make invalidation an optional pipeline step that runs only when public page TTL is longer than a few minutes. With hashed assets and short page TTLs, most releases need no invalidation at all.",
      "commonMistakes": [
        "Invalidating /* on every deploy as a habit. It masks wrong cache settings and empties the cache, which sends a burst of traffic to the origin.",
        "Using a non-hashed name such as app.js with a one-year TTL. Users keep the old file for up to a year and an invalidation is your only way out. Hash every file name.",
        "Expecting an invalidation to take effect everywhere instantly. It takes time; use the wait command in a pipeline."
      ],
      "sources": [
        { "title": "Invalidate files to remove content", "url": "https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html#Invalidation_Expiration" },
        { "title": "Paying for file invalidation", "url": "https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/PayingForInvalidation.html" },
        { "title": "AWS CLI: create-invalidation", "url": "https://docs.aws.amazon.com/cli/latest/reference/cloudfront/create-invalidation.html" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Why does the distribution use CACHING_DISABLED for /api/* but CACHING_OPTIMIZED for /assets/*?",
      "options": [
        "API answers can differ per user and change often, so they must reach the origin; hashed assets never change under one name, so they can be cached for a long time",
        "CACHING_OPTIMIZED only works with S3 origins and CACHING_DISABLED only works with load balancers",
        "CACHING_DISABLED makes CloudFront faster than any cached response",
        "Assets must be cached because S3 cannot answer more than one request per second"
      ],
      "answerIndex": 0,
      "explanation": "Cache policy choice follows how the content behaves. Hashed assets are immutable, so long caching is safe and cheap. API responses are dynamic and often personal, so each call must go to the app. Policies are not tied to origin types, and caching is not about S3 limits."
    },
    {
      "question": "Someone sends a request straight to https://origin.example.com/ without going through CloudFront. What should they get, and why?",
      "options": [
        "The home page, because the ALB is public",
        "A fixed 403 forbidden response, because the request lacks the X-Origin-Verify header and falls through to the listener's default action",
        "A redirect to www.example.com, because CloudFront intercepts all traffic to the domain",
        "A TLS error, because the certificate only covers www.example.com"
      ],
      "answerIndex": 1,
      "explanation": "The ALB forwards only requests with the secret header that CloudFront adds. Anything else matches no rule and gets the default action, a fixed 403. The certificate covers origin.example.com, and CloudFront does not intercept direct traffic to the ALB."
    },
    {
      "question": "Why is prune set to false on the BucketDeployment that uploads the assets?",
      "options": [
        "It makes uploads run faster",
        "It lets S3 compress the files automatically",
        "It is required for OAC to work",
        "Older hashed files must stay available for users whose HTML or browser cache still points to them"
      ],
      "answerIndex": 3,
      "explanation": "With prune on, each deploy would delete the previous release's hashed files. Pages already loaded or cached still ask for those names and would break. prune has nothing to do with speed, compression or OAC."
    },
    {
      "question": "After deploying a new frontend build with hashed file names, do you need to invalidate the asset paths?",
      "options": [
        "Yes, always invalidate /assets/* or users keep the old JavaScript",
        "No, new file names are new cache keys, and the new HTML points to them",
        "Yes, but only on weekdays when traffic is high",
        "No, because CloudFront never caches JavaScript files"
      ],
      "answerIndex": 1,
      "explanation": "A new release creates differently named files, which are not in any cache yet, so they are fetched fresh. The old names are untouched and still valid for old pages. CloudFront does cache JavaScript; invalidation just is not needed here."
    },
    {
      "question": "Why use HttpOrigin('origin.example.com') with HTTPS_ONLY instead of LoadBalancerV2Origin with the ALB's AWS DNS name?",
      "options": [
        "LoadBalancerV2Origin cannot talk to an ALB at all",
        "HttpOrigin makes the ALB cheaper because it skips the listener",
        "The origin certificate covers origin.example.com, not the AWS-generated ALB name, so only your own name passes the TLS name check",
        "HTTPS_ONLY is not allowed with LoadBalancerV2Origin"
      ],
      "answerIndex": 2,
      "explanation": "LoadBalancerV2Origin connects using the ALB's own DNS name, which your certificate does not list, so an HTTPS connection would fail the name check. HttpOrigin lets you choose a name that the certificate covers. It can talk to an ALB and supports HTTPS; the choice has no effect on cost."
    }
  ]
});
