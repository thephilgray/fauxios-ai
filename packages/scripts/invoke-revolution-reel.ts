import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { Resource } from "sst";
import { randomUUID } from "crypto";

const sfnClient = new SFNClient({});

async function main() {
  console.log("Triggering RevolutionReelOrchestrator...");

  try {
    const orchestratorArn = Resource.RevolutionReelOrchestrator.arn;
    if (!orchestratorArn) {
        throw new Error("RevolutionReelOrchestrator ARN not found.");
    }

    const command = new StartExecutionCommand({
      stateMachineArn: orchestratorArn,
      name: `RevolutionReelExecution-Manual-${randomUUID()}`,
      input: JSON.stringify({}),
    });

    const response = await sfnClient.send(command);
    console.log(`Successfully started execution: ${response.executionArn}`);

  } catch (error) {
    console.error("Error triggering RevolutionReel orchestrator:", error);
    process.exit(1);
  }
}

main();
