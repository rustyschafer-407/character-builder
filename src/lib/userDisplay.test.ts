import { describe, expect, it } from "vitest";
import { getAccessRowDisplayName, getAccessRowEmail } from "./userDisplay";

describe("access row display helpers", () => {
  it("returns display name and email when profile is complete", () => {
    const profile = {
      id: "11111111-1111-1111-1111-111111111111",
      display_name: "Rusty",
      email: "rustyschafer@me.com",
    };

    expect(getAccessRowDisplayName(profile)).toBe("Rusty");
    expect(getAccessRowEmail(profile)).toBe("rustyschafer@me.com");
  });

  it("uses email prefix when display_name is missing", () => {
    const profile = {
      id: "22222222-2222-2222-2222-222222222222",
      display_name: null,
      email: "bigbaloo64@yahoo.com",
    };

    expect(getAccessRowDisplayName(profile)).toBe("bigbaloo64");
    expect(getAccessRowEmail(profile)).toBe("bigbaloo64@yahoo.com");
  });

  it("returns Unknown user / No email on profile when profile fields are missing", () => {
    const profile = {
      id: "33333333-3333-3333-3333-333333333333",
      display_name: null,
      email: null,
    };

    expect(getAccessRowDisplayName(profile)).toBe("Unknown user");
    expect(getAccessRowEmail(profile)).toBe("No email on profile");
  });

  it("never surfaces raw UUID in visible display text", () => {
    const uuid = "62b431ef-0d5c-49ad-8cf2-5e0ede18a2a2";
    const profile = {
      id: uuid,
      display_name: null,
      email: null,
    };

    const displayName = getAccessRowDisplayName(profile);
    const email = getAccessRowEmail(profile);

    expect(displayName).toBe("Unknown user");
    expect(email).toBe("No email on profile");
    expect(displayName).not.toContain(uuid);
    expect(email).not.toContain(uuid);
  });
});
