import { Code2 } from "lucide-react";

const Header = () => {
  return (
    <div className="text-center space-y-2">
      <div className="flex items-center justify-center gap-2">
        <Code2 className="h-8 w-8 text-black-600" />
        <h1 className="text-4xl font-bold">Code Comparison Analysis</h1>
      </div>
      <p className="text-slate-600 dark:text-slate-400">
        Compare human-written code with LLM-generated code for security and
        quality metrics
      </p>
    </div>
  );
};
export default Header;
