import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";

export function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6 max-w-2xl" data-testid="page-settings">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight" data-testid="heading-settings">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your application preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Appearance</CardTitle>
          <CardDescription>
            Customize how the application looks on your device
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-3 block">Theme</Label>
            <RadioGroup
              value={theme}
              onValueChange={(value) => setTheme(value as "light" | "dark" | "system")}
              className="grid grid-cols-3 gap-4"
            >
              <Label
                htmlFor="light"
                className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 cursor-pointer [&:has([data-state=checked])]:border-primary"
                data-testid="option-theme-light"
              >
                <RadioGroupItem value="light" id="light" className="sr-only" />
                <Sun className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">Light</span>
              </Label>
              <Label
                htmlFor="dark"
                className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 cursor-pointer [&:has([data-state=checked])]:border-primary"
                data-testid="option-theme-dark"
              >
                <RadioGroupItem value="dark" id="dark" className="sr-only" />
                <Moon className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">Dark</span>
              </Label>
              <Label
                htmlFor="system"
                className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 cursor-pointer [&:has([data-state=checked])]:border-primary"
                data-testid="option-theme-system"
              >
                <RadioGroupItem value="system" id="system" className="sr-only" />
                <Monitor className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">System</span>
              </Label>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About</CardTitle>
          <CardDescription>
            Information about this application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Application</span>
              <span className="font-medium">Replit Dashboard App</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version</span>
              <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">1.0.0</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Built with</span>
              <span className="font-medium">React + Express + Replit</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
