import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

let s3Client = null;

const r2Key = process.env.R2_ACCESS_KEY_ID;
const r2Secret = process.env.R2_SECRET_ACCESS_KEY;
const r2Endpoint = process.env.R2_ENDPOINT;
const bucketName = process.env.R2_BUCKET_NAME || "larkvel-visitor-logs";

if (r2Key && r2Secret && r2Endpoint) {
  console.log("[R2] Initializing Cloudflare R2 Client...");
  s3Client = new S3Client({
    region: "auto",
    endpoint: r2Endpoint,
    credentials: {
      accessKeyId: r2Key,
      secretAccessKey: r2Secret,
    },
  });
} else {
  console.warn("[R2] ⚠️ Cloudflare R2 credentials (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT) are missing. Archiving will be disabled.");
}

export const r2 = {
  isEnabled: () => s3Client !== null,

  async putJSON(key, data) {
    if (!s3Client) throw new Error("R2 Client not initialized");
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: JSON.stringify(data),
      ContentType: "application/json",
    });
    await s3Client.send(command);
  },

  async getJSON(key) {
    if (!s3Client) throw new Error("R2 Client not initialized");
    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });
      const response = await s3Client.send(command);
      
      // Helper function to read readable stream as string
      const streamToString = (stream) =>
        new Promise((resolve, reject) => {
          const chunks = [];
          stream.on("data", (chunk) => chunks.push(chunk));
          stream.on("error", reject);
          stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        });

      const bodyContents = await streamToString(response.Body);
      return JSON.parse(bodyContents);
    } catch (e) {
      // Return null if key is not found (normal fallback for missing archives)
      if (e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw e;
    }
  }
};
