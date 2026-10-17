---
title: "Troubleshooting slow requests in Cloud Foundry"
---

What part of the Cloud Foundry request flow adds latency to your requests? Run the experiments in this topic to find out.

Cloud Foundry recommends running the procedures in this article in the order presented.

## App requests overview {#overview}

App requests typically transit the following components. Only the Gorouter and the app are within the scope of Cloud Foundry.

See the following diagram:

![There are four boxes from left to right: Client, Load Balancer, Router, and Backend. A larger box labeled CF encompasses the Router and Backend boxes.](/img/adminguide/request_lifecycle.png)

Any of the components in the diagram above can cause latency. Delays can also come from the network itself.

See the sections below for ways to diagnose what might be causing latency to your app requests and then address the issue or investigate further.

## Find the cause of latency {#cause}

The experiments described below can diagnose the cause of app request latency.

### Experiment 1: Measure total round-trip app requests {#total-latency}

To measure the total round-trip time for your deployed app that is experiencing latency, run:

```
time curl -v APP-ENDPOINT
```

Where `APP-ENDPOINT` is the URL endpoint for the deployed app.

For example:

```
$ time curl -v http://app1.app_domain.com

GET /hello HTTP/1.1
Host: app1.app_domain.com
User-Agent: curl/7.43.0
Accept: */*

HTTP/1.1 200 OK
Content-Type: application/json;charset=utf-8
Date: Tue, 14 Dec 2019 00:31:32 GMT
Server: nginx
X-Content-Type-Options: nosniff
X-Vcap-Request-Id: c30fad28-4972-46eb-7da6-9d07dc79b109
Content-Length: 602
hello world!

real 2m0.707s
user 0m0.005s
sys  0m0.007s
```

The `real` time output shows that the request to `http://app1.app_domain.com` took approximately two minutes, round-trip. This seems like an unreasonably long time, so it makes sense to find out where the delay is occurring.

To narrow down the cause of latency, see the following table for information about the output that you see after running `time curl -v APP-ENDPOINT`:

<div className="cf-table">

| Result | Explanation | Action |
| --- | --- | --- |
| <span className="cf-r cf-r--bad" />The output shows latency. | A component of your app request flow is causing a delay. | Continue with the rest of the experiments to try to narrow down which component is causing latency. |
| <span className="cf-r cf-r--ok" />The output does not show latency. | Your app experiences inconsistent delays. | Try to find an endpoint that is consistently experiencing latency. If that is not possible, then continue with the following experiments, running each of them multiple times. |
| The output shows the error: `Could not resolve host: NONEXISTENT.com` | DNS failed to resolve. | Troubleshoot your DNS configuration. |
| The output of `curl` returns normally, but there is no value for `X-Vcap-Request-Id`. | The request from the load balancer did not reach Cloud Foundry. | Troubleshoot your load balancer configuration. |

</div>

### Experiment 2: View request time in access logs {#within-cf}

In Cloud Foundry, delays can occur within Gorouter, within the app, or within the network between the two. If you suspect that you are experiencing latency, the most important logs are the access logs. The `cf logs` command streams log messages from Gorouter as well as from apps. This section describes how to find and understand the access log timestamps.

To view request time in access logs:

1. (Optional) Run `cf apps` to determine the name of the app.
2. Run:

   ```
   cf logs APP-NAME
   ```

   Where `APP-NAME` is the name of the app.
3. From another command line window, send a request to your app.
4. After your app returns a response, enter `Ctrl-C` to stop streaming `cf logs`.

   For example:

   ```
   $ cf logs app1

   2019-12-14T00:33:32.35-0800 [RTR/0] OUT app1.app_domain.com - [14/12/2019:00:31:32.348 +0000] "GET /hello HTTP/1.1" 200 0 60 "-" "HTTPClient/1.0 (2.7.1, ruby 2.3.3 (2019-11-21))" "10.0.4.207:20810" "10.0.48.67:61555" x_forwarded_for:"52.3.107.171" x_forwarded_proto:"http" vcap_request_id:"01144146-1e7a-4c77-77ab-49ae3e286fe9" response_time:120.00641734 gorouter_time:0.000217 app_id:"13ee085e-bdf5-4a48-aaaf-e854a8a975df" app_index:"0" x_b3_traceid:"3595985e7c34536a" x_b3_spanid:"3595985e7c34536a" x_b3_parentspanid:"-"
   2019-12-14T00:32:32.35-0800 [APP/PROC/WEB/0]OUT app1 received request at [14/12/2019:00:32:32.348 +0000] with "vcap_request_id": "01144146-1e7a-4c77-77ab-49ae3e286fe9"
   ^C
   ```

   In the example above, the first line contains the following timestamps:
   - `14/12/2016:00:31:32.348`: Gorouter receives request
   - `response_time:120.00641734`: Time measured from when Gorouter receives the request to when Gorouter finishes sending the response to the end user
   - `gorouter_time:0.000217`: Gorouter response time, not including the time that Gorouter spent sending the request to the back end app or the time waiting for the response from the app.

   The `response time` value shows that it took 120 seconds for Gorouter to send the request to the back end app, receive a response, and send that response to the end user. However, the `gorouter_time` value shows that the Gorouter took 0.000217 seconds to process the request and send the response back to the end user. This means that the bulk of the time was spent in Cloud Foundry either within the app, or the network between the Gorouter and the app. <br/><br/> If `gorouter_time` also reported 120 seconds, it would indicate that the time was mostly spent in the Gorouter itself, and relatively little time was spent sending the request to the app. <br/><br/> To narrow down the cause of latency, see the following table for information about the output that you see after running `cf logs APP-NAME`:

   <div className="cf-table">

   | Result | Explanation | Action |
   | --- | --- | --- |
   | <span className="cf-r cf-r--bad" />The output shows latency within `gorouter_time`. | Gorouter | Investigate gorouter logs as to why the latency is high. Investigate gorouter capacity metrics + possibly scale up |
   | The output shows latency within `response_time` but not in `gorouter_time`. | The network between Gorouter and the app, or the app itself, is causing latency. If the requests are uploading data to the app, latency between the client and gorouter may appear here as well | If the issue is not related to uploads, jump to experiment 5, and continue with the rest of the experiments to try to narrow down which component is causing latency. Otherwise continue with experiment 3. |
   | <span className="cf-r cf-r--ok" />The output does not show latency within `response_time`. | A component before Gorouter is causing latency to the request before it reaches Gorouter. | Continue with the rest of the experiments to try to narrow down which component is causing latency. |
   | The output does not show a log line. | Every incoming request should generate an access log message. If a request does not generate an access log message, it means Gorouter did not receive the request. | Troubleshoot your Gorouter configuration. |

   </div>

### Experiment 3: Duplicate latency on another endpoint {#duplicate-latency}

The next step to debugging latency is finding an endpoint that consistently experiences delays. Use a test app that does not make any internal or external requests or database calls. For example, see [dora](https://github.com/cloudfoundry/cf-acceptance-tests/tree/master/assets/dora) on GitHub.

If you cannot push any apps to your foundation, find an API endpoint that does not make any external calls to use for the rest of the experiments. For example, use a health or information endpoint.

To duplicate latency on another endpoint:

1. Push an example app.
2. Measure a request&rsquo;s full round-trip time from the client and back as by running:

   ```
   time curl -v TEST-APP-ENDPOINT
   ```

   Where `TEST-APP-ENDPOINT` is the URL endpoint for the test app. While every network is different, this request should take less than 0.2 seconds.

See the following table for information about the output that you see after running `time curl -v TEST-APP-ENDPOINT`:

<div className="cf-table">

| Result | Explanation | Action |
| --- | --- | --- |
| <span className="cf-r cf-r--bad" />The output shows latency. | One of the components in the app request path is causing latency. | Continue with the rest of the experiments, using the test app, to try to narrow down which component is causing latency. |
| <span className="cf-r cf-r--ok" />The output does not show latency. | Something in your app configuration is causing latency. | Evaluate your app for recent changes. |

</div>

If this experiment shows that something in your app is causing latency, use the following questions to start troubleshooting your app:

- Did you recently push any changes?
- Does your app make database calls?
  - If so, have your database queries changed?
- Does your app make requests to other microservices?
  - If so, is there a problem in a downstream app?
- Does your app log where it spends time? For more information, see [Use App Logs to Locate Delays in Cloud Foundry](#app_logs).

### Experiment 4: Remove the load balancer from request path {#remove-the-load-balancer}

The next step is to remove the load balancer from the test path by sending the request directly to Gorouter. You can do this by accessing the network where Gorouter is deployed, sending the traffic directly to the Gorouter IP address, and adding the route in the host header.

To remove the load balancer from the request path:

1. Choose a router VM from your deployment and get its IP address. Record this value and use it as the `ROUTER-IP` when you run the command in a later step.
2. Run:

   ```
   bosh ssh router/ROUTER-GUID
   ```

   Where `ROUTER-GUID` is the unique identifier for the router VM.
3. To determine the amount of time a request takes when it skips the load balancer, run:

   ```
   time curl ROUTER-IP -H "Host: TEST-APP-ENDPOINT"
   ```

   Where:
   - `ROUTER-IP` is the router VM IP address that you located in the first step.
   - `TEST-APP-ENDPOINT` is the URL endpoint for the test app.

See the following table for information about the output that you see after removing the load balancer from the app request path:

<div className="cf-table">

| Result | Explanation | Action |
| --- | --- | --- |
| <span className="cf-r cf-r--bad" />The output shows latency. | The load balancer is not causing latency. | Continue with the rest of the experiments, using the test app, to try to narrow down which component is causing latency. |
| <span className="cf-r cf-r--ok" />The output does not show latency. | A component before Gorouter is causing latency. | Look at your load balancer logs and logs for any other components that exist between the end client and Gorouter. Additionally, run these experiments with clients in different networks to help isolate where issues occur. |

</div>

### Experiment 5: Remove Gorouter from request path {#remove-the-gorouter}

The next step is to remove Gorouter from the request path. You can SSH into the router VM and send a request directly to the app.

To remove Gorouter from the app request path:

1. To retrieve the IP address and port number of the Diego Cell where your test app instance runs, run:

   ```
   cf ssh TEST-APP -c "env | grep CF_INSTANCE_ADDR"
   ```

   Where `TEST-APP` is the name of the test app.

   For example:

   ```
   $ cf ssh my-app -c "env | grep CF_INSTANCE_ADDR"
   ```
2. Choose any router VM from your deployment and SSH into it by running:

   ```
   bosh ssh router/ROUTER-GUID
   ```

   Where `ROUTER-GUID` is the unique identifier for the router VM.
3. To determine the amount of time a request takes when it skips Gorouter, run `time curl CF_INSTANCE_ADDR`.

See the following table for information about the output that you see after removing Gorouter from the app request path:

<div className="cf-table">

| Result | Explanation | Action |
| --- | --- | --- |
| <span className="cf-r cf-r--bad" />The output shows latency. | Gorouter is not causing latency. | Continue with the rest of the experiments, using the test app, to try to narrow down which component is causing latency. |
| <span className="cf-r cf-r--ok" />The output does not show latency. | Gorouter is causing latency. | See [Causes for Gorouter Latency](#gorouter-latency) and [Operations Recommendations](#ops-recommendations). |

</div>

### Experiment 6: Test the network between the router and the app {#test-internal-network}

The next step is to time how long it takes for your request to make it from the router VM to the Diego Cell where your app is deployed. You can do this by using `tcpdump` on both VMs.

To test the network between the router and the app:

1. Choose a router VM from your deployment and record its IP address. Use this value as the `ROUTER-IP` in later steps.
2. To get the IP address of the Diego Cell where your test app instance is running, run `cf ssh TEST-APP -c "env | grep CF_INSTANCE_IP"`, where `TEST-APP` is the name of the test app.
3. To get the port number of the Diego Cell where your test app instance is running, run `cf ssh TEST-APP -c "env | grep CF_INSTANCE_PORT"`, where `TEST-APP` is the name of the test app.
4. On the command line, locate the router VM that matches the `ROUTER-IP` value from the first step.
5. To SSH into the router VM, run `bosh ssh router/ROUTER-GUID`, where `ROUTER-GUID` is the unique identifier for the router VM.
6. On the router VM, log in as root.
7. To capture all packets going to your app, run `tcpdump 'dst CF_INSTANCE_IP and dst port CF_INSTANCE_PORT'`.
8. In a second command line window, SSH into the Diego Cell that corresponds with `CF_INSTANCE_IP`. Run `bosh ssh digeo-cell/DIEGO-CELL-GUID`, where `DIEGO-CELL-GUID` is the unique identifier for the Diego Cell where your app is running.
9. On the Diego Cell, log in as root.
10. To capture all packets going to your app, run `tcpdump 'dst port CF_INSTANCE_PORT and src ROUTER-IP'`, where `ROUTER-IP` is the router VM IP address that you recorded in the first step.
11. In a third command line window, run `ssh ROUTER-IP`, where `ROUTER-IP` is the router VM IP address.
12. To make a request to your app, run `curl CF_INSTANCE_IP:CF_INSTANCE_PORT`.
13. Compare the first packet captured on the router VM with the first packet captured on the Diego Cell. The packets should match. Use the timestamps to determine how long it took the packet to traverse the network.

    If you use a test app, this can be the only traffic to your app. If you are not using a test app and there is traffic to your app, then these `tcpdump` commands can result in many packet captures. If the `tcpdump` results are too verbose to track, you can write them to a `pcap` file and use `wireshark` to find the important packets. To write `tcpdump` commands to a file, use the `-w` flag. For example: `tcpdump -w router.pcap`.

See the following table for information about the output that you see after testing the network between the router and the app:

<div className="cf-table">

| Result | Explanation | Action |
| --- | --- | --- |
| <span className="cf-r cf-r--bad" />The output shows latency. | Your network is causing latency. | Troubleshoot your network configuration. |
| <span className="cf-r cf-r--ok" />The output does not show latency. | A component in your app request path is causing latency. | Repeat the diagnostic experiments to narrow down which component is causing latency. Follow the steps in [Experiment 1: Measure Total Round-Trip App Requests](#total-latency) and ensure that you are consistently experiencing latency. |

</div>

## Investigate or address latency {#next}

Once you have determined the cause of app request latency, investigate further or address the issue as described in the sections below.

### Use app logs to locate delays in Cloud Foundry {#app_logs}

To gain a more detailed picture of where delays exist in your request path, augment the logging that your app generates. For example, call your logging library from the request handler to generate log lines when your app receives a request and finishes processing it:

```
2019-12-14T00:33:32.35-0800 [RTR/0] OUT app1.app_domain.com - [14/12/2019:00:31:32.348 +0000] "GET /hello HTTP/1.1" 200 0 60 "-" "HTTPClient/1.0 (2.7.1, ruby 2.3.3 (2019-11-21))" "10.0.4.207:20810" "10.0.48.67:61555" x_forwarded_for:"52.3.107.171" x_forwarded_proto:"http" vcap_request_id:"01144146-1e7a-4c77-77ab-49ae3e286fe9" response_time:120.00641734 app_id:"13ee085e-bdf5-4a48-aaaf-e854a8a975df" app_index:"0" x_b3_traceid:"3595985e7c34536a" x_b3_spanid:"3595985e7c34536a" x_b3_parentspanid:"-"
2019-12-14T00:32:32.35-0800 [APP/PROC/WEB/0]OUT app1 received request at [14/12/2019:00:32:32.348 +0000] with "vcap_request_id": "01144146-1e7a-4c77-77ab-49ae3e286fe9"
2019-12-14T00:32:32.50-0800 [APP/PROC/WEB/0]OUT app1 finished processing req at [14/12/2019:00:32:32.500 +0000] with "vcap_request_id": "01144146-1e7a-4c77-77ab-49ae3e286fe9"
```

By comparing the router access log messages from [Experiment 2: View Request Time in Access Logs](#within-cf) with the new app logs above, you can construct the following timeline:

- `14/12/2016:00:31:32.348`: Gorouter receives request
- `2016-12-14T00:32:32.35`: App receives request
- `2016-12-14T00:32:32.50`: App finishes processing request
- `2016-12-14T00:33:32.35`: Gorouter finishes processing request

The timeline indicates that Gorouter took close to 60 seconds to send the request to the app and another 60 seconds to receive the response from the app. This suggests either of the following:

- A delay with Gorouter. See [Causes for Gorouter Latency](#gorouter-latency).
- Network latency between Gorouter and the Diego Cells that host the app.

### Causes for Gorouter latency {#gorouter-latency}

Two potential causes for Gorouter latency are:

- Routers are under heavy load from incoming client requests.
- Apps are taking a long time to process requests. This increases the number of concurrent threads held open by Gorouter, reducing capacity to handle requests for other apps.

### Operations recommendations {#ops-recommendations}

- Monitor CPU load for Gorouters. At high CPU (70%+), latency increases. If the Gorouter CPU reaches this threshold, consider adding another Gorouter instance.
- Monitor latency of all routers using metrics from the Firehose. Do not monitor the average latency across all routers. Instead, monitor them individually on the same graph.
- Consider using Pingdom against an app on your Cloud Foundry deployment to monitor latency and uptime. For more information, see the [Pingdom](http://www.pingdom.com/) website.
- Consider enabling access logs on your load balancer. To enable access logs, see your load balancer documentation. Just as you use Gorouter access log messages above to determine latency from Gorouter, you can compare load balancer logs to identify latency between the load balancer and Gorouter. You can also compare load balancer response times with the client response times to identify latency between client and load balancer.
- Deploy a nozzle to the Loggregator Firehose to track metrics for Gorouter. For more information, see [Deploying a Nozzle to the Loggregator Firehose](https://docs.cloudfoundry.org/loggregator/nozzle-tutorial.html). Available metrics include:
  - CPU utilization
  - Latency
  - Requests per second
