Application Support Pack – AKS 3-Tier Application 

Generated on: 2026-03-15 08:41 UTC 

**1\. Application Overview**   
This support pack provides operational information required by the Site Reliability Engineering (SRE) team to monitor, support, and maintain the 3-tier sample application hosted on Azure Kubernetes Service (AKS) with Azure SQL Database in the Australia East region. The application integrates with upstream and downstream systems hosted in an on-premises data center. 

**2\. Service Level Agreement (SLA)**   
Target Availability: 99.9% monthly uptime. 

Maximum Allowed Downtime per Month: \~43 minutes. 

The SLA covers the availability of the AKS application services, ingress endpoints, and connectivity to the Azure SQL Database. Planned maintenance windows are excluded from SLA calculations. 

**3\. Support Team Contact Information** 

| Team  | Email  | Contact  |
| :---- | :---- | :---- |
| SRE Operations  | sre-support@samplecorp.cloud  | \+61-2-9000-1101  |
| Cloud Platform Team  | cloud-platform@samplecorp.cloud  | \+61-2-9000-1102  |
| Database Operations  | db-support@samplecorp.cloud  | \+61-2-9000-1103  |
| Network Operations  | network-ops@samplecorp.cloud  | \+61-2-9000-1104  |

**4\. Monitoring and Observability Metrics** 

* AKS Cluster Health – node readiness, node CPU and memory usage   
* Pod health – restart counts, pod CPU/memory utilization   
* Application response time and request latency   
* HTTP error rates (4xx, 5xx)   
* Azure SQL Database CPU/DTU utilization   
* Database connection pool usage   
* Network latency between AKS and Azure SQL   
* Ingress traffic volume and request throughput   
* Disk usage for container logs   
* Kubernetes events and failed deployments 

**5\. Alerting Threshold Examples** 

* CPU utilization above 80% for 10 minutes   
* Pod restart count greater than 3 within 5 minutes   
* Application error rate above 5%   
* Database CPU above 85% for 15 minutes   
* API latency above 2 seconds for 5 minutes 

**6\. Incident Escalation Process**   
Severity 1 – Critical outage affecting production users: Immediate escalation to SRE lead and Cloud Platform team. 

Severity 2 – Partial degradation: Notify SRE team and investigate within 30 minutes. 

Severity 3 – Minor issues or alerts: Investigate during business hours. 

