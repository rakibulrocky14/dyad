import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSettings } from "@/hooks/useSettings";
import type { UserSettings } from "@/lib/schemas";

export function VertexConfiguration({
  settings,
}: {
  settings: UserSettings | null | undefined;
}) {
  const { updateSettings } = useSettings();
  const current = settings?.providerSettings?.vertexai ?? {};

  const [projectId, setProjectId] = useState<string>(current.projectId || "");
  const [location, setLocation] = useState<string>(current.location || "");
  const [jsonPath, setJsonPath] = useState<string>(
    current.serviceAccountJsonPath || "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChooseJson = async () => {
    try {
      const result = await (window as any).electron.ipcRenderer.invoke(
        "vertex:select-service-account-json",
      );
      if (result && result.path) {
        setJsonPath(result.path as string);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to select JSON file");
    }
  };

  const handleSave = async () => {
    if (!projectId || !location || !jsonPath) {
      setError("Project ID, location, and JSON file are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updates: Partial<UserSettings> = {
        providerSettings: {
          ...settings?.providerSettings,
          vertexai: {
            ...settings?.providerSettings?.vertexai,
            projectId,
            location,
            serviceAccountJsonPath: jsonPath,
          },
        },
      };
      await updateSettings(updates);
    } catch (e: any) {
      setError(e?.message || "Failed to save Vertex settings");
    } finally {
      setSaving(false);
    }
  };

  const configured = Boolean(projectId && location && jsonPath);

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Project ID</label>
          <Input
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="my-gcp-project"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Location</label>
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="us-central1"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Service Account JSON
        </label>
        <div className="flex gap-2">
          <Input
            value={jsonPath}
            onChange={(e) => setJsonPath(e.target.value)}
            placeholder="C:\\path\\to\\service-account.json"
          />
          <Button onClick={handleChooseJson} variant="outline">
            Choose File
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          This file will be used via Google Application Default Credentials for
          Vertex AI.
        </p>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : configured ? "Update" : "Save"}
        </Button>
      </div>
    </div>
  );
}
