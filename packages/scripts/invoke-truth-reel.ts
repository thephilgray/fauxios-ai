import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { Resource } from "sst";
import { randomUUID } from "crypto";

const sfnClient = new SFNClient({});

async function main() {
  console.log("Triggering TruthReelOrchestrator...");

  try {
    const orchestratorArn = Resource.TruthReelOrchestrator.arn;
    if (!orchestratorArn) {
        throw new Error("TruthReelOrchestrator ARN not found.");
    }

    const command = new StartExecutionCommand({
      stateMachineArn: orchestratorArn,
      name: `TruthReelExecution-Manual-${randomUUID()}`,
      input: JSON.stringify({}),
    });

    const response = await sfnClient.send(command);
    console.log(`Successfully started execution: ${response.executionArn}`);

  } catch (error) {
    console.error("Error triggering TruthReel orchestrator:", error);
    process.exit(1);
  }
}

main();
