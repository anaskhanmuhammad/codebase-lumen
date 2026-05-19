"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const AccordionContext = React.createContext({});

const Accordion = React.forwardRef(({ children, className, type, collapsible, defaultValue, ...props }, ref) => {
  const [value, setValue] = React.useState(defaultValue || (type === "multiple" ? [] : ""));

  const handleValueChange = (itemValue) => {
    if (type === "single") {
       setValue(value === itemValue && collapsible ? "" : itemValue);
    } else {
       setValue(itemValue);
    }
  };

  return (
    <AccordionContext.Provider value={{ value, onValueChange: handleValueChange }}>
      <div ref={ref} className={cn("", className)} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
});
Accordion.displayName = "Accordion";

const AccordionItem = React.forwardRef(({ className, value, ...props }, ref) => {
  return (
    <AccordionContext.Provider value={{ ...React.useContext(AccordionContext), itemValue: value }}>
        <div ref={ref} className={cn("border-b", className)} {...props} />
    </AccordionContext.Provider>
  );
});
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
  const { value, onValueChange, itemValue } = React.useContext(AccordionContext);
  const isOpen = value === itemValue;

  return (
    <h3 className="flex">
      <button
        ref={ref}
        onClick={() => onValueChange(itemValue)}
        className={cn(
          "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
          className
        )}
        data-state={isOpen ? "open" : "closed"}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
      </button>
    </h3>
  );
});
AccordionTrigger.displayName = "AccordionTrigger";

const AccordionContent = React.forwardRef(({ className, children, ...props }, ref) => {
  const { value, itemValue } = React.useContext(AccordionContext);
  const isOpen = value === itemValue;

  if (!isOpen) return null;

  return (
    <div
      ref={ref}
      className={cn("overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down", className)}
      {...props}
    >
      <div className={cn("pb-4 pt-0", className)}>{children}</div>
    </div>
  );
});
AccordionContent.displayName = "AccordionContent";

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
