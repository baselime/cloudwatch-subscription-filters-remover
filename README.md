# cloudwatch-subscription-filters-remover
A service to loop through your CloudWatch log groups and remove the subscription filters matching a criteria

---

## Architecture

The service comprises:
- A Lambda function: `cloudwatch-sub-filters-remover-prod-command`
- An SQS queue: `cloudwatch-subscription-filters-remover-queue`
- A dead-letter queue: `cloudwatch-subscription-filters-remover-dead-letter-queue`

The Lambda function is triggered when a message is sent to the SQS queue. The Lambda function loops through all the log groups in the provided AWS region and checks for subscription filters matching the criteria set in the message sent to the SQS queue. When a subscription filter is found, it is deleted.

## Installation

This lambda function has no other deps than the AWS SDK which is provided in the Lambda runtime by default.

## Deployment

The service is deployed with the [Serverless Framework](https://serverless.com). Please make sure you have the serverless CLI installed locally or if using a CI pipeline, it must be installed in your CI environment.

Before deployment, ensure you've edited the region in the `serverless.yml` file. The default region is `eu-west-2`.

Run the following command to deploy:

``` bash
sls deploy --stage <stage>
```

where `<stage>` is the stage you want to deploy the service to; typically `prod`/`dev`/`uat`.

## Invocation

To invoke the service, you must send a message to the SQS queue. The form of the message must be:

```
{"prefix": "<prefix>"}
```

where `<prefix>` is the prefix of the subscription filters you want to delete.

You can send those messages to the queue using the [AWS Console](https://aws.amazon.com) or with the AWS CLI:

```bash
aws sqs send-message --queue-url https://sqs.<region>.amazonaws.com/<account-id>/cloudwatch-subscription-filters-remover-dead-letter-queue --message-body '{"prefix": "<prefix>"}'
```

where:
- `<region>` is the AWS region
- `<account-id>` is your AWS account id
- `<prefix>` is the prefix of the subscriptions filters to delete

