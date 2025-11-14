import React from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { User, Bot, FileCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function CodeInputCard({
  title,
  icon,
  value,
  setValue,
  disabled,
}) {
  const Icon = icon === "human" ? User : Bot;
  const type = icon === "human" ? "Source" : "AI";

  return (
    <Card className="border-2 hover:border-blue-300 transition-colors">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon />
            <CardTitle>{title}</CardTitle>
          </div>
          <Badge variant="outline">
            <FileCode className="h-3 w-3 mr-1" />
            {type}
          </Badge>
        </div>
        <CardDescription>Paste your code here</CardDescription>
      </CardHeader>

      <CardContent className="pt-6">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Code Input</Label>
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="min-h-[400px] font-mono text-sm"
            disabled={disabled}
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>Lines: {value.split("\n").length}</span>
            <span>Characters: {value.length}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
