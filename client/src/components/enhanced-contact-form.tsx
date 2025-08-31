// enhanced-contact-form.tsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { insertContactSchema, PREDEFINED_SKILLS, PROJECT_TYPES } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Contact, InsertContact } from "@shared/schema";
import { z } from "zod";
import { X, Plus, Save, User, Building, Settings, Clock, Briefcase } from "lucide-react";
import { ValidationFeedback } from "@/components/validation/ValidationFeedback";
import { validationService, ValidationResult } from "@/services/validationService";

const enhancedFormSchema = insertContactSchema.extend({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["company", "division", "person"]),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  phone: z
    .string()
    .regex(/^[\+]?[\d\s\-\(\)\.]+$/, "Invalid phone format")
    .optional()
    .or(z.literal("")),
  secondaryPhone: z
    .string()
    .regex(/^[\+]?[\d\s\-\(\)\.]+$/, "Invalid phone format")
    .optional()
    .or(z.literal("")),
  website: z.string().url("Invalid website URL").optional().or(z.literal("")),
  skills: z.array(z.string()).default([]),
  availabilityStatus: z
    .enum(["available", "busy", "partially_available", "unavailable"])
    .default("available"),
  preferredWorkHours: z.string().optional(),
  workStartTime: z.string().optional(),
  workEndTime: z.string().optional(),
  workTimezone: z.string().default("UTC"),
  rolePreference: z
    .enum(["leader", "contributor", "specialist", "advisor", "any"])
    .default("any"),
  projectTypes: z.array(z.string()).default([]),
  assignmentCapacity: z.enum(["low", "normal", "high"]).default("normal"),
  workflowRole: z.enum(["approver", "executor", "reviewer", "observer"]).optional(),
  maxConcurrentTasks: z.number().min(1).max(50).default(5),
  costPerHour: z.number().positive().optional(),
  timezone: z.string().default("UTC"),
  languages: z.array(z.string()).default(["English"]),
  currentWorkload: z.number().min(0).default(0),
  skillProficiency: z
    .record(z.enum(["beginner", "intermediate", "advanced", "expert"]))
    .optional()
    .default({}),
  certifications: z
    .array(
      z.object({
        name: z.string().min(1, "Certification name is required"),
        issuer: z.string().min(1, "Certification issuer is required"),
        expiry: z.string().optional(),
      })
    )
    .optional()
    .default([]),
  notes: z.string().optional(),
});

type EnhancedFormData = z.infer<typeof enhancedFormSchema>;

interface EnhancedContactFormProps {
  contact?: Contact;
  onClose?: () => void;
  embedded?: boolean;
}


type FormContentProps = {
  form: UseFormReturn<EnhancedFormData> | any;
  currentStep: string;
  setCurrentStep: (v: string) => void;
  isEditMode: boolean;
  createMutation: ReturnType<typeof useMutation>;
  onCancel: () => void;
  selectedType: EnhancedFormData["type"];
  parentOptions: Contact[];
  addSkill: (s: string) => void;
  removeSkill: (s: string) => void;
  addProjectType: (s: string) => void;
  removeProjectType: (s: string) => void;
  addLanguage: (s: string) => void;
  removeLanguage: (s: string) => void;
  handlePrevious: () => void;
  handleNext: () => void;
  onSubmit: (data: EnhancedFormData) => void;
  customSkillInput: string;
  setCustomSkillInput: (value: string) => void;
  validationResults: ValidationResult;
  isValidating: boolean;
};

/**
 * Hoisted form content – stable component type
 */
function FormContent({
  form,
  currentStep,
  setCurrentStep,
  isEditMode,
  createMutation,
  onCancel,
  selectedType,
  parentOptions,
  addSkill,
  removeSkill,
  addProjectType,
  removeProjectType,
  addLanguage,
  removeLanguage,
  handlePrevious,
  handleNext,
  onSubmit,
  validationResults,
  isValidating,
  customSkillInput,
  setCustomSkillInput,
}: FormContentProps) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Real-time validation feedback */}
        <ValidationFeedback
          errors={validationResults.errors}
          warnings={validationResults.warnings}
          isValid={validationResults.isValid}
          isValidating={isValidating}
          className="mb-4"
        />

        <Tabs value={currentStep} onValueChange={setCurrentStep}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="basic" className="flex items-center gap-1">
              <User className="h-4 w-4" />
              Basic
            </TabsTrigger>
            <TabsTrigger value="contact" className="flex items-center gap-1">
              <Building className="h-4 w-4" />
              Contact
            </TabsTrigger>
            <TabsTrigger value="hierarchy" className="flex items-center gap-1">
              <Building className="h-4 w-4" />
              Hierarchy
            </TabsTrigger>
            <TabsTrigger value="skills" className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Skills
            </TabsTrigger>
            <TabsTrigger value="workflow" className="flex items-center gap-1">
              <Briefcase className="h-4 w-4" />
              Workflow
            </TabsTrigger>
          </TabsList>

          {/* Basic Information */}
          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Contact Type <span className="text-red-500 font-medium">*</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select contact type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="company">Company</SelectItem>
                        <SelectItem value="division">Division</SelectItem>
                        <SelectItem value="person">Person</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Full Name <span className="text-red-500 font-medium">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Enter full name..." {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {selectedType === "person" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter first name..." {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter last name..." {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="jobTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter job title..." {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter department..." {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            {selectedType !== "person" && (
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter description..."
                        {...field}
                        value={field.value || ""}
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </TabsContent>

          {/* Contact Details */}
          <TabsContent value="contact" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Enter email..." {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter phone..." {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="secondaryPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Secondary Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter secondary phone..." {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter address..." {...field} value={field.value || ""} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          {/* Hierarchy */}
          <TabsContent value="hierarchy" className="space-y-4">
            {parentOptions.length > 0 && (
              <FormField
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Organization</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select parent organization (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {parentOptions.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Hierarchy Rules:</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Companies can be standalone or have divisions</li>
                <li>• Divisions must belong to a company</li>
                <li>• People can belong to companies or divisions</li>
                <li>• Circular references are automatically prevented</li>
              </ul>
            </div>
          </TabsContent>

          {/* Skills */}
          <TabsContent value="skills" className="space-y-4">
            {selectedType === "person" ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="availabilityStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Availability Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select availability" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="busy">Busy</SelectItem>
                            <SelectItem value="partially_available">Partially Available</SelectItem>
                            <SelectItem value="unavailable">Unavailable</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="workTimezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Work Timezone
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value || "UTC"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="UTC">UTC (Coordinated Universal Time)</SelectItem>
                            <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                            <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                            <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                            <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                            <SelectItem value="Europe/London">London (GMT/BST)</SelectItem>
                            <SelectItem value="Europe/Paris">Paris (CET/CEST)</SelectItem>
                            <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                            <SelectItem value="Asia/Shanghai">Shanghai (CST)</SelectItem>
                            <SelectItem value="Australia/Sydney">Sydney (AEST/AEDT)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <FormLabel className="flex items-center gap-1 mb-3">
                      <Clock className="h-4 w-4" />
                      Preferred Work Hours
                    </FormLabel>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="workStartTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Time</FormLabel>
                            <FormControl>
                              <Input 
                                type="time" 
                                {...field} 
                                value={field.value || "09:00"}
                                className="w-full"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="workEndTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Time</FormLabel>
                            <FormControl>
                              <Input 
                                type="time" 
                                {...field} 
                                value={field.value || "17:00"}
                                className="w-full"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <FormLabel>Skills</FormLabel>
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {(form.watch("skills") || []).map((skill: string) => (
                        <Badge key={skill} variant="secondary" className="flex items-center gap-1">
                          {skill}
                          <X className="h-3 w-3 cursor-pointer" onClick={() => removeSkill(skill)} />
                        </Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {PREDEFINED_SKILLS.filter(
                        (s) => !(form.watch("skills") || []).includes(s)
                      )
                        .slice(0, 10)
                        .map((skill) => (
                          <Button
                            key={skill}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addSkill(skill)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {skill}
                          </Button>
                        ))}
                    </div>
                    
                    {/* Custom Skill Input */}
                    <div className="flex gap-2 mt-3">
                      <Input
                        placeholder="Type a custom skill..."
                        value={customSkillInput}
                        onChange={(e) => setCustomSkillInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const skillName = customSkillInput.trim();
                            if (skillName && !(form.watch("skills") || []).includes(skillName)) {
                              addSkill(skillName);
                              setCustomSkillInput('');
                            }
                          }
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const skillName = customSkillInput.trim();
                          if (skillName && !(form.watch("skills") || []).includes(skillName)) {
                            addSkill(skillName);
                            setCustomSkillInput('');
                          }
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Skill Proficiency Section */}
                  <div className="space-y-4 border-t pt-4">
                    <FormLabel className="text-base font-semibold">
                      Skill Proficiency Levels
                    </FormLabel>
                    <div className="space-y-3">
                      {Object.entries(form.watch("skillProficiency") || {}).map(([skill, level]) => (
                        <div key={skill} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                          <span className="font-medium">{skill}</span>
                          <div className="flex items-center gap-2">
                            <Select 
                              value={level} 
                              onValueChange={(newLevel) => {
                                const current = form.getValues("skillProficiency") || {};
                                form.setValue("skillProficiency", {
                                  ...current,
                                  [skill]: newLevel as "beginner" | "intermediate" | "advanced" | "expert"
                                });
                              }}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="beginner">Beginner</SelectItem>
                                <SelectItem value="intermediate">Intermediate</SelectItem>
                                <SelectItem value="advanced">Advanced</SelectItem>
                                <SelectItem value="expert">Expert</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const current = form.getValues("skillProficiency") || {};
                                const updated = { ...current };
                                delete updated[skill];
                                form.setValue("skillProficiency", updated);
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      
                      {/* Add skill proficiency for existing skills */}
                      <div className="flex flex-wrap gap-2">
                        {(form.watch("skills") || [])
                          .filter(skill => !(form.watch("skillProficiency") || {})[skill])
                          .map((skill) => (
                            <Button
                              key={skill}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const current = form.getValues("skillProficiency") || {};
                                form.setValue("skillProficiency", {
                                  ...current,
                                  [skill]: "intermediate"
                                });
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Set {skill} Level
                            </Button>
                          ))}
                      </div>
                    </div>
                  </div>

                  {/* Certifications Section */}
                  <div className="space-y-4 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-base font-semibold">
                        Certifications
                      </FormLabel>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const current = form.getValues("certifications") || [];
                          form.setValue("certifications", [
                            ...current,
                            { name: "", issuer: "", expiry: "" }
                          ]);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Certification
                      </Button>
                    </div>
                    
                    <div className="space-y-3">
                      {(form.watch("certifications") || []).map((cert, index) => (
                        <div key={index} className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg">
                          <div>
                            <FormLabel className="text-sm">Certification Name</FormLabel>
                            <Input
                              placeholder="e.g., AWS Solutions Architect"
                              value={cert.name}
                              onChange={(e) => {
                                const current = form.getValues("certifications") || [];
                                const updated = [...current];
                                updated[index] = { ...updated[index], name: e.target.value };
                                form.setValue("certifications", updated);
                              }}
                            />
                          </div>
                          <div>
                            <FormLabel className="text-sm">Issuer</FormLabel>
                            <Input
                              placeholder="e.g., Amazon Web Services"
                              value={cert.issuer}
                              onChange={(e) => {
                                const current = form.getValues("certifications") || [];
                                const updated = [...current];
                                updated[index] = { ...updated[index], issuer: e.target.value };
                                form.setValue("certifications", updated);
                              }}
                            />
                          </div>
                          <div className="flex items-end gap-2">
                            <div className="flex-1">
                              <FormLabel className="text-sm">Expiry Date</FormLabel>
                              <Input
                                type="date"
                                value={cert.expiry || ""}
                                onChange={(e) => {
                                  const current = form.getValues("certifications") || [];
                                  const updated = [...current];
                                  updated[index] = { ...updated[index], expiry: e.target.value };
                                  form.setValue("certifications", updated);
                                }}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const current = form.getValues("certifications") || [];
                                const updated = current.filter((_, i) => i !== index);
                                form.setValue("certifications", updated);
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      
                      {(form.watch("certifications") || []).length === 0 && (
                        <div className="text-center py-4 text-gray-500">
                          No certifications added yet. Click "Add Certification" to get started.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <User className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">Skills Management Not Applicable</h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  Skills and availability tracking is designed for individual contacts. For{" "}
                  {selectedType === "company" ? "companies" : "divisions"}, this information is
                  managed at the person level within the organization.
                </p>
              </div>
            )}
          </TabsContent>

          {/* Workflow */}
          <TabsContent value="workflow" className="space-y-4">
            {selectedType === "person" ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="rolePreference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role Preference</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select role preference" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="leader">Leader</SelectItem>
                            <SelectItem value="contributor">Contributor</SelectItem>
                            <SelectItem value="specialist">Specialist</SelectItem>
                            <SelectItem value="advisor">Advisor</SelectItem>
                            <SelectItem value="any">Any Role</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="assignmentCapacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assignment Capacity</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select capacity" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low (1-2 projects)</SelectItem>
                            <SelectItem value="normal">Normal (3-5 projects)</SelectItem>
                            <SelectItem value="high">High (6+ projects)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div>
                  <FormLabel>Preferred Project Types</FormLabel>
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {(form.watch("projectTypes") || []).map((type) => (
                        <Badge key={type} variant="secondary" className="flex items-center gap-1">
                          {type}
                          <X className="h-3 w-3 cursor-pointer" onClick={() => removeProjectType(type)} />
                        </Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {PROJECT_TYPES.filter((t) => !(form.watch("projectTypes") || []).includes(t))
                        .slice(0, 8)
                        .map((type) => (
                          <Button
                            key={type}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addProjectType(type)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {type}
                          </Button>
                        ))}
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Enhanced Workflow Configuration
                  </h3>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <FormField
                      control={form.control}
                      name="workflowRole"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Workflow Role</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select workflow role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="approver">Approver</SelectItem>
                              <SelectItem value="executor">Executor</SelectItem>
                              <SelectItem value="reviewer">Reviewer</SelectItem>
                              <SelectItem value="observer">Observer</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="maxConcurrentTasks"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Concurrent Tasks</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="50"
                              placeholder="5"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 5)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="costPerHour"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cost Per Hour ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) =>
                                field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="timezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            Primary Timezone
                          </FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value || "UTC"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select primary timezone" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="UTC">UTC (Coordinated Universal Time)</SelectItem>
                              <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                              <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                              <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                              <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                              <SelectItem value="Europe/London">London (GMT/BST)</SelectItem>
                              <SelectItem value="Europe/Paris">Paris (CET/CEST)</SelectItem>
                              <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                              <SelectItem value="Asia/Shanghai">Shanghai (CST)</SelectItem>
                              <SelectItem value="Australia/Sydney">Sydney (AEST/AEDT)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-sm text-gray-500 mt-1">
                            Primary timezone for scheduling meetings and general availability
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="currentWorkload"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Workload</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div>
                    <FormLabel>Languages</FormLabel>
                    <div className="mt-2 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {(form.watch("languages") || []).map((language) => (
                          <Badge key={language} variant="secondary" className="flex items-center gap-1">
                            {language}
                            <X className="h-3 w-3 cursor-pointer" onClick={() => removeLanguage(language)} />
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Add language"
                          onKeyPress={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const input = e.target as HTMLInputElement;
                              if (input.value.trim()) {
                                addLanguage(input.value.trim());
                                input.value = "";
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Add any additional notes..."
                          {...field}
                          value={field.value || ""}
                          rows={4}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : (
              <div className="text-center py-8">
                <Briefcase className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">Workflow Configuration Not Applicable</h3>
                <p className="text-gray-500 max-w-md mx-auto mb-4">
                  Workflow roles, capacity management, and task assignments are managed at the individual level.{" "}
                  {selectedType === "company" ? "Companies" : "Divisions"} serve as organizational
                  containers for people who have workflow capabilities.
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg max-w-md mx-auto">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    💡 <strong>Tip:</strong> Add individual contacts within this {selectedType} to configure their
                    workflow roles and assignments.
                  </p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-4 border-t">
          <div className="flex space-x-2">
            {currentStep !== "basic" && (
              <Button type="button" variant="outline" onClick={handlePrevious}>
                Previous
              </Button>
            )}
            {currentStep !== "workflow" && (
              <Button type="button" variant="outline" onClick={handleNext}>
                Next
              </Button>
            )}
          </div>

          <div className="flex space-x-3">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isEditMode ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isEditMode ? "Update Contact" : "Create Contact"}
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}

export default function EnhancedContactForm({
  contact,
  onClose,
  embedded = false,
}: EnhancedContactFormProps) {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState("basic");
  const [isDraft, setIsDraft] = useState(false);
  const [customSkillInput, setCustomSkillInput] = useState("");
  const [validationResults, setValidationResults] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    warnings: []
  });
  const [isValidating, setIsValidating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isEditMode = !!contact;

  const form = useForm<EnhancedFormData>({
    resolver: zodResolver(enhancedFormSchema),
    defaultValues: contact
      ? {
          name: contact.name || "",
          type: contact.type,
          firstName: contact.firstName || "",
          lastName: contact.lastName || "",
          jobTitle: contact.jobTitle || "",
          department: contact.department || "",
          email: contact.email || "",
          phone: contact.phone || "",
          secondaryPhone: contact.secondaryPhone || "",
          address: contact.address || "",
          website: contact.website || "",
          description: contact.description || "",
          parentId: contact.parentId || "",
          skills: contact.skills || [],
          availabilityStatus: contact.availabilityStatus || "available",
          preferredWorkHours: contact.preferredWorkHours || "",
          workStartTime: contact.workStartTime || "09:00",
          workEndTime: contact.workEndTime || "17:00",
          workTimezone: contact.workTimezone || "UTC",
          rolePreference: contact.rolePreference || "any",
          projectTypes: contact.projectTypes || [],
          assignmentCapacity: (contact.assignmentCapacity as "low" | "normal" | "high") || "normal",
          workflowRole: contact.workflowRole || undefined,
          maxConcurrentTasks: contact.maxConcurrentTasks || 5,
          costPerHour: contact.costPerHour ? Number(contact.costPerHour) : undefined,
          timezone: contact.timezone || "UTC",
          languages: contact.languages || ["English"],
          currentWorkload: contact.currentWorkload || 0,
          skillProficiency: (contact as any).skillProficiency || {},
          certifications: (contact as any).certifications || [],
          tags: contact.tags || [],
          notes: contact.notes || "",
          isActive: contact.isActive ?? true,
        }
      : {
          name: "",
          type: "company",
          firstName: "",
          lastName: "",
          jobTitle: "",
          department: "",
          email: "",
          phone: "",
          secondaryPhone: "",
          address: "",
          website: "",
          description: "",
          parentId: "",
          skills: [],
          availabilityStatus: "available",
          preferredWorkHours: "",
          workStartTime: "09:00",
          workEndTime: "17:00",
          workTimezone: "UTC",
          rolePreference: "any",
          projectTypes: [],
          assignmentCapacity: "normal",
          workflowRole: undefined,
          maxConcurrentTasks: 5,
          costPerHour: undefined,
          timezone: "UTC",
          languages: ["English"],
          currentWorkload: 0,
          skillProficiency: {},
          certifications: [],
          tags: [],
          notes: "",
          isActive: true,
        },
  });

  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts/hierarchy"],
    retry: false,
  });

  const selectedType = form.watch("type");

  // Auto-save draft
  useEffect(() => {
    const subscription = form.watch((data) => {
      const hasData = Object.values(data).some((value) =>
        value && (typeof value === "string" ? value.trim() : true)
      );
      if (hasData && !isEditMode) {
        if (!isDraft) setIsDraft(true); // avoid unnecessary flips
        localStorage.setItem("contactDraft", JSON.stringify(data));
      }
    });
    return () => subscription.unsubscribe();
  }, [form, isEditMode, isDraft]);

  // Load draft on mount
  useEffect(() => {
    if (!isEditMode) {
      const draft = localStorage.getItem("contactDraft");
      if (draft) {
        try {
          const draftData = JSON.parse(draft);
          (Object.keys(draftData) as (keyof EnhancedFormData)[]).forEach((key) => {
            if ((draftData as any)[key]) {
              form.setValue(key, (draftData as any)[key]);
            }
          });
          setIsDraft(true);
        } catch (error) {
          console.error("Failed to load draft:", error);
        }
      }
    }
  }, [form, isEditMode]);

  // Reset form when dialog opens for new contacts
  useEffect(() => {
    if (!isEditMode && open) {
      // Clear localStorage draft and reset form to defaults
      localStorage.removeItem("contactDraft");
      form.reset({
        name: "",
        type: "company",
        firstName: "",
        lastName: "",
        jobTitle: "",
        department: "",
        email: "",
        phone: "",
        secondaryPhone: "",
        address: "",
        website: "",
        description: "",
        parentId: "",
        skills: [],
        availabilityStatus: "available",
        preferredWorkHours: "",
        workStartTime: "09:00",
        workEndTime: "17:00",
        workTimezone: "UTC",
        rolePreference: "any",
        projectTypes: [],
        assignmentCapacity: "normal",
        workflowRole: undefined,
        maxConcurrentTasks: 5,
        costPerHour: undefined,
        timezone: "UTC",
        languages: ["English"],
        currentWorkload: 0,
        skillProficiency: {},
        certifications: [],
        tags: [],
        notes: "",
        isActive: true,
      });
      setIsDraft(false);
      setCurrentStep("basic");
      setValidationResults({
        isValid: true,
        errors: [],
        warnings: []
      });
    }
  }, [open, isEditMode, form]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertContact) => {
      const endpoint = isEditMode ? `/api/contacts/${contact!.id}` : "/api/contacts";
      const method = isEditMode ? "PUT" : "POST";
      const response = await apiRequest(method, endpoint, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/hierarchy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/stats"] });
      toast({
        title: "Success",
        description: `Contact ${isEditMode ? "updated" : "created"} successfully`,
      });
      localStorage.removeItem("contactDraft");
      setOpen(false);
      form.reset();
      onClose?.();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: `Failed to ${isEditMode ? "update" : "create"} contact`,
        variant: "destructive",
      });
    },
  });

  // Real-time validation function
  const validateFormData = useCallback(async (data: Partial<EnhancedFormData>) => {
    if (!data.name && !data.email && !data.type) return; // Skip validation for empty forms
    
    setIsValidating(true);
    try {
      const result = await validationService.validateEntity('contact', data);
      setValidationResults(result);
      
      // Show validation warnings in toast if any
      if (result.warnings.length > 0) {
        toast({
          title: "Validation Warnings",
          description: `${result.warnings.length} warning(s) found`,
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Validation error:', error);
    } finally {
      setIsValidating(false);
    }
  }, [toast]);

  // Watch for form changes and validate
  useEffect(() => {
    const subscription = form.watch((data) => {
      // Debounce validation to avoid too many API calls
      const timeoutId = setTimeout(() => {
        const cleanData = {
          ...data,
          skills: (data.skills || []).filter((s): s is string => typeof s === 'string' && s.trim() !== '')
        };
        validateFormData(cleanData);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    });
    
    return () => subscription.unsubscribe();
  }, [form, validateFormData]);

  const onSubmit = async (data: EnhancedFormData) => {
    // Final validation before submission
    setIsValidating(true);
    const finalValidation = await validationService.validateEntity('contact', data);
    setIsValidating(false);
    
    if (!finalValidation.isValid) {
      toast({
        title: "Validation Failed",
        description: "Please fix the validation errors before submitting",
        variant: "destructive",
      });
      return;
    }

    const submitData: InsertContact = {
      ...data,
      parentId: data.parentId && data.parentId !== "none" ? data.parentId : undefined,
      skills: data.skills || [],
      projectTypes: data.projectTypes || [],
      tags: data.tags || [],
      skillProficiency: data.skillProficiency || {},
      certifications: data.certifications || [],
    };
    createMutation.mutate(submitData);
  };

  const parentOptions = useMemo(() => {
    if (!contacts) return [];
    const flattenContacts = (contactList: Contact[]): Contact[] => {
      const result: Contact[] = [];
      contactList.forEach((c) => {
        result.push(c);
        if ((c as any).children) result.push(...flattenContacts((c as any).children));
      });
      return result;
    };
    const all = flattenContacts(contacts);
    switch (selectedType) {
      case "division":
        return all.filter((c) => c.type === "company");
      case "person":
        return all.filter((c) => c.type === "division" || c.type === "company");
      default:
        return [];
    }
  }, [selectedType, contacts]);

  const progress = 33;

  // Skill & tag helpers
  const addSkill = useCallback(
    (skill: string) => {
      const current = form.getValues("skills") || [];
      if (!current.includes(skill)) form.setValue("skills", [...current, skill]);
    },
    [form]
  );
  const removeSkill = useCallback(
    (skill: string) => {
      const current = form.getValues("skills") || [];
      form.setValue("skills", current.filter((s) => s !== skill));
    },
    [form]
  );
  const addProjectType = useCallback(
    (pt: string) => {
      const current = form.getValues("projectTypes") || [];
      if (!current.includes(pt)) form.setValue("projectTypes", [...current, pt]);
    },
    [form]
  );
  const removeProjectType = useCallback(
    (pt: string) => {
      const current = form.getValues("projectTypes") || [];
      form.setValue("projectTypes", current.filter((t) => t !== pt));
    },
    [form]
  );
  const addLanguage = useCallback(
    (lang: string) => {
      const current = form.getValues("languages") || [];
      if (!current.includes(lang)) form.setValue("languages", [...current, lang]);
    },
    [form]
  );
  const removeLanguage = useCallback(
    (lang: string) => {
      const current = form.getValues("languages") || [];
      form.setValue("languages", current.filter((l) => l !== lang));
    },
    [form]
  );

  // Step nav
  const handlePrevious = useCallback(() => {
    const steps = ["basic", "contact", "hierarchy", "skills", "workflow"];
    const idx = steps.indexOf(currentStep);
    if (idx > 0) setCurrentStep(steps[idx - 1]);
  }, [currentStep]);
  const handleNext = useCallback(() => {
    const steps = ["basic", "contact", "hierarchy", "skills", "workflow"];
    const idx = steps.indexOf(currentStep);
    if (idx < steps.length - 1) setCurrentStep(steps[idx + 1]);
  }, [currentStep]);

  const onCancel = () => {
    if (embedded) onClose?.();
    else setOpen(false);
  };

  // Render
  if (embedded) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            {isEditMode ? "Edit Contact" : "Add New Contact"}
            {isDraft && (
              <Badge variant="outline" className="text-orange-600">
                <Save className="h-3 w-3 mr-1" />
                Draft Saved
              </Badge>
            )}
          </h2>
          {onClose && (
            <Button variant="ghost" onClick={onClose} className="p-2">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Progress value={progress} className="flex-1" />
          <span className="text-sm text-gray-500">{progress}% Complete</span>
        </div>

        <FormContent
          form={form}
          currentStep={currentStep}
          setCurrentStep={setCurrentStep}
          isEditMode={isEditMode}
          createMutation={createMutation as any}
          onCancel={onCancel}
          selectedType={selectedType}
          parentOptions={parentOptions}
          addSkill={addSkill}
          removeSkill={removeSkill}
          addProjectType={addProjectType}
          removeProjectType={removeProjectType}
          addLanguage={addLanguage}
          removeLanguage={removeLanguage}
          handlePrevious={handlePrevious}
          handleNext={handleNext}
          onSubmit={onSubmit}
          validationResults={validationResults}
          isValidating={isValidating}
          customSkillInput={customSkillInput}
          setCustomSkillInput={setCustomSkillInput}
        />
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEditMode ? (
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Edit Contact
          </Button>
        ) : (
          <Button className="bg-primary hover:bg-primary-600">
            <Plus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{isEditMode ? "Edit Contact" : "Add New Contact"}</span>
            {isDraft && (
              <Badge variant="outline" className="text-orange-600">
                <Save className="h-3 w-3 mr-1" />
                Draft Saved
              </Badge>
            )}
          </DialogTitle>
          <div className="flex items-center space-x-2">
            <Progress value={progress} className="flex-1" />
            <span className="text-sm text-gray-500">{progress}% Complete</span>
          </div>
        </DialogHeader>

        <FormContent
          form={form}
          currentStep={currentStep}
          setCurrentStep={setCurrentStep}
          isEditMode={isEditMode}
          createMutation={createMutation as any}
          onCancel={onCancel}
          selectedType={selectedType}
          parentOptions={parentOptions}
          addSkill={addSkill}
          removeSkill={removeSkill}
          addProjectType={addProjectType}
          removeProjectType={removeProjectType}
          addLanguage={addLanguage}
          removeLanguage={removeLanguage}
          handlePrevious={handlePrevious}
          handleNext={handleNext}
          onSubmit={onSubmit}
          validationResults={validationResults}
          isValidating={isValidating}
          customSkillInput={customSkillInput}
          setCustomSkillInput={setCustomSkillInput}
        />
      </DialogContent>
    </Dialog>
  );
}
