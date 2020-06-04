import { AzureFunction, Context } from "@azure/functions";
import axios from "axios";
import * as cheerio from "cheerio";
import * as mongodb from "mongodb";
const mongoClient = mongodb.MongoClient;

interface VerObj {
  id: string;
  date: string;
  versionstring: string;
}

const timerTrigger: AzureFunction = async function (context: Context, myTimer: any): Promise<void> {
  var timeStamp = new Date().toISOString();

  const response = await axios.get("https://terraria.org/");
  const $ = cheerio.load(response.data);
  const footer = $("div.page-footer > a");
  const dedicated = footer.toArray().filter((my) => $(my).text().includes("PC Dedicated Server"));
  const version_text = $(dedicated).attr("href").split("/").pop();
  console.log(version_text);

  const notify = async (version: string) => {
    // post slack
    const webhook_url = process.env["SLACK_WEBHOOK_URL"];
    const contents = {
      text: `<!channel> New Terraria Server.
  ${version}
  <https://terraria.org/>`,
    };

    await axios.post(webhook_url, JSON.stringify(contents));
  };

  const mongourl = process.env["MONGODB_URL"];

  let client = await mongoClient.connect(mongourl, {
    useUnifiedTopology: true,
  });

  const insertnew = async (cl: mongodb.Collection<any>) => {
    await collection.insertOne({
      id: "latest",
      date: new Date().toISOString(),
      versionstring: version_text,
    });
  };

  const updatecurrent = async (cl: mongodb.Collection<any>, current: VerObj, next: string) => {
    const prev = current.versionstring;
    if (prev !== next) {
      notify(next);
    }

    const value = {
      id: "latest",
      date: new Date().toISOString(),
      versionstring: next,
    };

    await cl.updateOne({ id: "latest" }, { $set: value });
  };

  let collection = client.db("azfdb").collection("terrariaserver");
  const kv: VerObj = await collection.findOne({
    id: "latest",
  });

  if (!kv) {
    await insertnew(collection);
  } else {
    if ("date" in kv) {
      await updatecurrent(collection, kv, version_text);
    } else {
      await insertnew(collection);
    }
  }

  console.log(kv);
  await client.close();
};

export default timerTrigger;
