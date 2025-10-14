import { Resource } from "sst";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { Buffer } from 'buffer';

const lambdaClient = new LambdaClient({});

async function invokeGenerator() {
  const mockEvent = {
    headline: "Local Cat Elected Mayor in Landslide Victory, Promises More Naps and Tuna Subsidies",
    summary: "In a surprising turn of events, a feline named Chairman Meow has been elected mayor of a small town, campaigning on a platform of increased napping opportunities and a universal tuna subsidy program. Residents are cautiously optimistic about the new administration."
  };

  try {
    console.log("Invoking fauxiosGenerator with mock event...");
    const command = new InvokeCommand({
      FunctionName: Resource.FauxiosGenerator.name,
      Payload: JSON.stringify(mockEvent),
      InvocationType: "RequestResponse", // Or "Event" for async invocation
    });
    const { Payload } = await lambdaClient.send(command);
    const result = Buffer.from(Payload as any).toString();
    console.log("fauxiosGenerator invoked successfully. Result:", result);
  } catch (error) {
    console.error("Error invoking fauxiosGenerator:", error);
  }
}

invokeGenerator();