import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const realProblemsData = [
  { problemId: "economic_anxiety", description: "Economic Anxiety (e.g., high home prices, flat wages)" },
  { problemId: "social_isolation", description: "Social Isolation (e.g., loneliness, lack of community)" },
  { problemId: "misinformation", description: "Misinformation (e.g., tribalism, a need to blame others)" },
  { problemId: "consumerism_waste", description: "Consumerism & Waste (e.g., planned obsolescence, a throwaway culture)" },
  { problemId: "political_apathy", description: "Political Apathy (e.g., a feeling of powerlessness, civic disengagement)" },
];

const historicalThemesData = [
  { themeId: "gilded_age", description: "The Gilded Age (1870-1900): A period of materialism, political corruption, and extreme wealth inequality." },
  { themeId: "manifest_destiny", description: "Manifest Destiny (1840-1890): The belief in a nation's divine right to expand, often at the expense of others." },
  { themeId: "roaring_twenties", description: "An era of economic and cultural exuberance that masked underlying anxieties." },
  { themeId: "cold_war", description: "A period of mutually assured destruction, proxy conflicts, and a pervasive culture of fear." },
];

const problemStatsData = [
  { problemName: "social_isolation", statisticId: "lonelyAdults", value: "21%", description: "21% of adults in the U.S. feel lonely.", source: "Unknown" },
  { problemName: "social_isolation", statisticId: "socialMediaTime", value: "2 hours and 24 minutes", description: "The average American spends 2 hours and 24 minutes per day on social media. This is 3 times more than the average time they spend interacting with friends in person.", source: "Unknown" },
  { problemName: "social_isolation", statisticId: "communityEvents", value: "75%", description: "75% of adults want more accessible \"fun community events.\"", source: "Unknown" },
  { problemName: "economic_anxiety", statisticId: "homePriceRatio", value: "5.4", description: "The median home price-to-income ratio in the U.S. is 5.4, up from roughly 3.5 in 1985.", source: "Visual Capitalist" },
  { problemName: "economic_anxiety", statisticId: "laHomePriceRatio", value: "12.2", description: "In some major cities like Los Angeles, the ratio is as high as 12.2.", source: "Unknown" },
  { problemName: "economic_anxiety", statisticId: "wageVsHomePriceGrowth", value: "74% vs 54%", description: "While home prices rose by 74% from 2010 to 2022, wages only rose by 54%.", source: "Unknown" },
  { problemName: "economic_anxiety", statisticId: "consumerDebt", value: "$17.39 trillion", description: "U.S. consumer debt as of late 2024 was $17.39 trillion, with credit card debt at $1 trillion.", source: "Unknown" },
  { problemName: "workplace_burnout", statisticId: "whiteCollarBurnout", value: "82%", description: "82% of white-collar workers reported being \"slightly\" to \"extremely\" burned out in 2024.", source: "Unknown" },
  { problemName: "workplace_burnout", statisticId: "healthcareSpendingBurnout", value: "$125 billion to $190 billion", description: "Annual healthcare spending on workplace burnout is estimated to be between $125 billion to $190 billion.", source: "Unknown" },
  { problemName: "workplace_burnout", statisticId: "averageCommuteTime", value: "26.8 minutes", description: "The average daily commute time in the U.S. is 26.8 minutes, and 19% of people commute between 30 and 59 minutes each day.", source: "Unknown" },
  { problemName: "workplace_burnout", statisticId: "teleworkPercentage", value: "22.9%", description: "As of early 2024, 22.9% of workers teleworked, with 40.4% of workers with a bachelor's degree or higher doing so.", source: "Unknown" },
  { problemName: "consumerism_waste", statisticId: "eWasteGenerated", value: "62 million tons", description: "62 million tons of e-waste are generated annually, with a documented recycling rate of just 22%.", source: "Unknown" },
  { problemName: "consumerism_waste", statisticId: "smartphoneLifespan", value: "2.5 years", description: "The average lifespan of a smartphone is 2.5 years.", source: "Unknown" },
  { problemName: "consumerism_waste", statisticId: "plannedObsolescenceBelief", value: "86%", description: "A recent survey found that 86% of consumers believe their home appliances and electronics are deliberately designed to have short lifespans.", source: "Unknown" },
  { problemName: "consumerism_waste", statisticId: "foodWasteImpulse", value: "60%", description: "60% of impulse purchases in a grocery store end up as food waste.", source: "Unknown" },
  { problemName: "misinformation", statisticId: "localNewspaperClosures", value: "2,200", description: "Between 2005 and 2021, over 2,200 local newspapers in the U.S. closed.", source: "Unknown" },
  { problemName: "misinformation", statisticId: "newsroomEmploymentDrop", value: "half", description: "Between 2008 and 2020, newsroom employment fell by more than half.", source: "Unknown" },
  { problemName: "misinformation", statisticId: "economicCostMisinformation", value: "$78 billion", description: "A 2019 report estimated the global economic cost of misinformation at $78 billion annually, a number that is now considered much higher due to advancements in AI and deepfakes.", source: "Unknown" },
];

const authorsData = [
  {
    authorId: "author-1",
    name: "Anya Sharma",
    concept: "Real Problem",
    style: "Anya Sharma writes with a keen, analytical eye, dissecting complex issues with a deceptively calm and academic tone. Her satire often highlights the absurd logical conclusions of everyday human failings.",
  },
  {
    authorId: "author-2",
    name: "Miles Corbin",
    concept: "Grand Unified Theory",
    style: "Miles Corbin crafts intricate, sprawling narratives that connect seemingly unrelated events with a conspiratorial flair. His prose is dense with pseudo-intellectual jargon, making the absurd sound profoundly plausible.",
  },
  {
    authorId: "author-3",
    name: "Vivian Holloway",
    concept: "Historical Narrator",
    style: "Vivian Holloway's articles are a masterclass in historical parallels, drawing sharp, witty connections between contemporary headlines and past eras. Her style is direct, often employing a dry, observational humor that underscores humanity's repetitive follies.",
  },
];

export async function handler() {
  // Seed RealProblems table
  const realProblemsTableName = Resource.RealProblems.name;
  for (const problem of realProblemsData) {
    const putCommand = new PutCommand({
      TableName: realProblemsTableName,
      Item: problem,
    });
    await ddbDocClient.send(putCommand);
    console.log(`Added Real Problem: ${problem.problemId}`);
  }
  console.log("RealProblems table seeded successfully.");

  // Seed HistoricalThemes table
  const historicalThemesTableName = Resource.HistoricalThemes.name;
  for (const theme of historicalThemesData) {
    const putCommand = new PutCommand({
      TableName: historicalThemesTableName,
      Item: theme,
    });
    await ddbDocClient.send(putCommand);
    console.log(`Added Historical Theme: ${theme.themeId}`);
  }
  console.log("HistoricalThemes table seeded successfully.");

  // Seed ProblemStats table
  const problemStatsTableName = Resource.ProblemStats.name;
  for (const stat of problemStatsData) {
    const putCommand = new PutCommand({
      TableName: problemStatsTableName,
      Item: stat,
    });
    await ddbDocClient.send(putCommand);
    console.log(`Added Problem Stat: ${stat.problemName} - ${stat.statisticId}`);
  }
  console.log("ProblemStats table seeded successfully.");

  // Seed Authors table
  const authorsTableName = Resource.Authors.name;
  for (const author of authorsData) {
    const putCommand = new PutCommand({
      TableName: authorsTableName,
      Item: author,
    });
    await ddbDocClient.send(putCommand);
    console.log(`Added Author: ${author.name}`);
  }
  console.log("Authors table seeded successfully.");
}
