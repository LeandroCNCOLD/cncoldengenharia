import { describe, it, expect } from "vitest";
import { encodeProject, decodeProject, buildShareUrl } from "../useShareableLink";
import type { SavedProject } from "../../store/useProjectStore";

const mockProject: SavedProject = {
  id: "abc-123",
  name: "Projeto Teste Compartilhado",
  type: "component_workspace",
  createdAt: 1700000000000,
  updatedAt: 1700000001000,
  snapshot: {
    compressorModel: "2KES-05",
    compressorEnvelope: null,
  },
};

describe("encodeProject / decodeProject", () => {
  it("round-trip: encode → decode retorna o mesmo projeto", () => {
    const token = encodeProject(mockProject);
    const decoded = decodeProject(token);

    expect(decoded.id).toBe(mockProject.id);
    expect(decoded.name).toBe(mockProject.name);
    expect(decoded.type).toBe(mockProject.type);
    expect(decoded.snapshot.compressorModel).toBe(mockProject.snapshot.compressorModel);
  });

  it("token não contém caracteres inválidos para URL (+, /, =)", () => {
    const token = encodeProject(mockProject);
    expect(token).not.toContain("+");
    expect(token).not.toContain("/");
    expect(token).not.toContain("=");
  });
});

describe("buildShareUrl", () => {
  it("URL contém o token e a rota /shared", () => {
    const url = buildShareUrl(mockProject, "https://app.cncold.com");
    expect(url).toContain("/shared?p=");
    expect(url).toContain("https://app.cncold.com");
    // O token deve ser decodificável
    const token = new URL(url).searchParams.get("p") ?? "";
    const decoded = decodeProject(token);
    expect(decoded.id).toBe(mockProject.id);
  });
});
