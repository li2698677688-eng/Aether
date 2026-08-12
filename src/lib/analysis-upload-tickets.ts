interface UploadTicketData {
  path: string;
  signedUrl: string;
  token: string;
}

interface UploadTicketClient {
  storage: {
    from(bucket: string): {
      createSignedUploadUrl(
        path: string,
        options?: { upsert?: boolean },
      ): PromiseLike<{ data: UploadTicketData | null; error: unknown }>;
    };
  };
}

interface UploadTicketObject {
  bucket: string;
  key: string;
  path: string;
}

export async function createAnalysisUploadTicketEntries(
  client: UploadTicketClient,
  objects: UploadTicketObject[],
) {
  return Promise.all(objects.map(async ({ bucket, key, path }) => {
    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert: true });
    if (error) throw error;
    if (!data) throw new Error("SIGNED_UPLOAD_TICKET_MISSING");
    return [key, { path, token: data.token, signedUrl: data.signedUrl }] as const;
  }));
}
