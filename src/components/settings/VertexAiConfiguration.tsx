import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserSettings } from "@/lib/schemas";
import { showError, showSuccess } from "@/lib/toast";

interface VertexAiConfigurationProps {
  settings: UserSettings | null | undefined;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  isSaving: boolean;
  setIsSaving: (isSaving: boolean) => void;
}

export function VertexAiConfiguration({
  settings,
  updateSettings,
  isSaving,
  setIsSaving,
}: VertexAiConfigurationProps) {
  const [projectId, setProjectId] = useState("");
  const [location, setLocation] = useState("");
  const [serviceAccount, setServiceAccount] = useState<string>("");
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    const vertexSettings = settings?.vertexai;
    if (vertexSettings) {
      setProjectId(vertexSettings.projectId || "");
      setLocation(vertexSettings.location || "");
      if (vertexSettings.serviceAccount) {
        setServiceAccount(JSON.stringify(vertexSettings.serviceAccount, null, 2));
        setFileName("Loaded from settings");
      }
    }
  }, [settings]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result;
          if (typeof content === "string") {
            // Validate that it's a valid JSON
            JSON.parse(content);
            setServiceAccount(content);
            setFileName(file.name);
          }
        } catch (error) {
          showError("Invalid JSON file.");
          console.error("Error parsing JSON file:", error);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let parsedServiceAccount;
      if (serviceAccount) {
        try {
          parsedServiceAccount = JSON.parse(serviceAccount);
            } catch {
          showError("Invalid JSON format in service account details.");
          setIsSaving(false);
          return;
        }
      }

      await updateSettings({
        vertexai: {
          projectId,
          location,
          serviceAccount: parsedServiceAccount,
        },
      });
      showSuccess("Vertex AI settings saved.");
    } catch (error: any) {
      showError(`Error saving settings: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Vertex AI Configuration</CardTitle>
        <CardDescription>
          Configure your Google Cloud project and service account to use Vertex
          AI. This information is stored locally and securely on your machine.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="projectId">Project ID</Label>
          <Input
            id="projectId"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="e.g. my-gcp-project"
            disabled={isSaving}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. us-central1"
            disabled={isSaving}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="serviceAccount">Service Account JSON</Label>
          <Input
            id="serviceAccount"
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="cursor-pointer"
            disabled={isSaving}
          />
          {fileName && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Selected file: {fileName}
            </p>
          )}
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Configuration"}
        </Button>
      </CardContent>
    </Card>
  );
}
