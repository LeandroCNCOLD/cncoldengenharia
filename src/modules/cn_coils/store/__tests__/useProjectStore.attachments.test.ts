import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore } from "../useProjectStore";

beforeEach(() => {
  // Limpa projetos antes de cada teste
  useProjectStore.setState({ projects: [], activeProjectId: null });
});

function createTestProject() {
  return useProjectStore.getState().saveProject("Projeto Teste", "component_workspace", {});
}

describe("useProjectStore — attachments", () => {
  it("addAttachment armazena o anexo corretamente", () => {
    const projectId = createTestProject();
    const { addAttachment } = useProjectStore.getState();

    addAttachment(projectId, {
      name: "datasheet.pdf",
      type: "datasheet",
      dataUrl: "data:application/pdf;base64,abc123",
    });

    const project = useProjectStore.getState().projects.find((p) => p.id === projectId);
    expect(project?.snapshot.attachments).toHaveLength(1);
    expect(project?.snapshot.attachments?.[0].name).toBe("datasheet.pdf");
    expect(project?.snapshot.attachments?.[0].type).toBe("datasheet");
    expect(project?.snapshot.attachments?.[0].id).toBeTruthy();
    expect(project?.snapshot.attachments?.[0].addedAt).toBeGreaterThan(0);
  });

  it("removeAttachment remove o anexo corretamente", () => {
    const projectId = createTestProject();
    const { addAttachment, removeAttachment } = useProjectStore.getState();

    addAttachment(projectId, {
      name: "foto.jpg",
      type: "photo",
      dataUrl: "data:image/jpeg;base64,xyz",
    });

    const attachmentId =
      useProjectStore.getState().projects.find((p) => p.id === projectId)?.snapshot
        .attachments?.[0].id ?? "";

    removeAttachment(projectId, attachmentId);

    const project = useProjectStore.getState().projects.find((p) => p.id === projectId);
    expect(project?.snapshot.attachments).toHaveLength(0);
  });
});
