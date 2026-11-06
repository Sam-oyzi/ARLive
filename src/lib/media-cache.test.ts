import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesEtag, uploadEtag } from "./media-cache";

test("a revalidated browser image matches its immutable URL and size", () => {
  const etag = uploadEtag("targets/page-one.jpg", 1024);
  assert.equal(matchesEtag(etag, etag), true);
  assert.equal(matchesEtag(`W/${etag}`, etag), true);
  assert.equal(matchesEtag(`"old", ${etag}`, etag), true);
  assert.equal(matchesEtag(uploadEtag("targets/page-two.jpg", 1024), etag), false);
  assert.equal(matchesEtag(uploadEtag("targets/page-one.jpg", 2048), etag), false);
  assert.equal(matchesEtag(null, etag), false);
});
