// Local Node uploads stream to disk in one request. Workers provide chunked R2 uploads.
export async function multipartUpload(_request: Request, _ownerId: string): Promise<Response> {
  return Response.json({ error: "Chunked uploads are not needed on the local server." }, { status: 501 });
}
