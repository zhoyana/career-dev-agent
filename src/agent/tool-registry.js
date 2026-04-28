// tool-registry.js 负责统一管理工具定义和执行。
  // LLM 侧只需要拿到工具列表；运行时只需要按名字执行工具。

  function createToolRegistry(tools) {
    const toolMap = new Map(
      tools.map((tool) => {
        return [tool.name, tool];
      })
    );

    function listToolDefinitions() {
      return tools.map((tool) => {
        return {
          type: "function",
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
          strict: true,
        };
      });
    }

    function getTool(name) {
      const tool = toolMap.get(name);

      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      return tool;
    }

    function validateStringField(toolName, fieldName, value, fieldSchema) {
      if (typeof value !== "string") {
        throw new Error(
          `Tool ${toolName} expects string field "${fieldName}", got ${typeof value}`
        );
      }

      if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
        throw new Error(
          `Tool ${toolName} field "${fieldName}" must be one of:
  ${fieldSchema.enum.join(", ")}`
        );
      }
    }

    function validateObjectInput(toolName, input, schema) {
      if (!schema || schema.type !== "object") {
        throw new Error(`Tool ${toolName} has unsupported input schema`);
      }

      if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error(`Tool ${toolName} expects object input`);
      }

      const properties = schema.properties || {};
      const requiredFields = Array.isArray(schema.required) ? schema.required : [];
      const allowedFields = new Set(Object.keys(properties));

      for (const fieldName of requiredFields) {
        if (!(fieldName in input)) {
          throw new Error(`Tool ${toolName} missing required field "${fieldName}"`);
        }
      }

      if (schema.additionalProperties === false) {
        for (const key of Object.keys(input)) {
          if (!allowedFields.has(key)) {
            throw new Error(`Tool ${toolName} does not allow extra field "${key}"`);
          }
        }
      }

      for (const [fieldName, fieldSchema] of Object.entries(properties)) {
        if (!(fieldName in input)) {
          continue;
        }

        const value = input[fieldName];

        if (fieldSchema.type === "string") {
          validateStringField(toolName, fieldName, value, fieldSchema);
          continue;
        }

        throw new Error(
          `Tool ${toolName} field "${fieldName}" uses unsupported schema type
  "${fieldSchema.type}"`
        );
      }

      return input;
    }

    function validateToolInput(name, input) {
      const tool = getTool(name);
      return validateObjectInput(name, input, tool.inputSchema);
    }

    async function executeToolCall(name, input) {
      const tool = getTool(name);
      const validatedInput = validateToolInput(name, input);

      return tool.execute(validatedInput);
    }

    return {
      listToolDefinitions,
      validateToolInput,
      executeToolCall,
    };
  }

  module.exports = { createToolRegistry };
