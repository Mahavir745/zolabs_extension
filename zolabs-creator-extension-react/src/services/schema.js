const numericTypes = {
  1: "text",
  2: "textarea",
  3: "email",
  5: "number",
  6: "decimal",
  8: "currency",
  10: "date",
  11: "datetime",
  12: "picklist",
  13: "radio",
  14: "multiselect",
  16: "boolean",
  27: "phone",
  29: "name",
  30: "address"
};

function fieldLink(field) {
  return field.link_name || field.linkname || field.field_name || "";
}

function fieldLabel(field) {
  return field.display_name || field.displayname || fieldLink(field);
}

function choices(field) {
  const source =
    field.choices ||
    field.choice_values ||
    field.allowed_values ||
    field.options ||
    [];

  if (!Array.isArray(source)) return [];

  return source
    .map((item) =>
      typeof item === "object"
        ? item.value || item.display_value || item.name || item.key
        : item
    )
    .filter(Boolean);
}

function normaliseType(field) {
  if (Array.isArray(field.subfields) && field.subfields.length) {
    const label = fieldLabel(field).toLowerCase();
    if (label.includes("address")) return "address";
    return "name";
  }

  const numberType = numericTypes[Number(field.type)];
  if (numberType) return numberType;

  const text = String(field.type || "").toLowerCase();
  if (text.includes("email")) return "email";
  if (text.includes("phone")) return "phone";
  if (text.includes("date-time") || text.includes("datetime")) return "datetime";
  if (text.includes("date")) return "date";
  if (text.includes("dropdown") || text.includes("picklist")) return "picklist";
  if (text.includes("radio")) return "radio";
  if (text.includes("multi") || text.includes("checkbox")) return "multiselect";
  if (text.includes("decision") || text.includes("boolean")) return "boolean";
  if (text.includes("currency")) return "currency";
  if (text.includes("decimal") || text.includes("percent")) return "decimal";
  if (text.includes("number")) return "number";
  if (text.includes("address")) return "address";
  if (text.includes("name")) return "name";
  if (text.includes("url")) return "url";
  if (text.includes("multiline") || text.includes("textarea")) return "textarea";
  return "text";
}

export function normaliseCreatorFields(rawFields) {
  return rawFields
    .map((field) => {
      const linkName = fieldLink(field);
      if (!linkName) return null;

      return {
        linkName,
        label: fieldLabel(field),
        type: normaliseType(field),
        required: Boolean(
          field.mandatory ||
            field.is_mandatory ||
            field.required ||
            field.is_required
        ),
        choices: choices(field),
        subfields: Array.isArray(field.subfields)
          ? field.subfields.map((subfield) => ({
              linkName: fieldLink(subfield),
              label: fieldLabel(subfield),
              required: Boolean(
                subfield.mandatory ||
                  subfield.is_mandatory ||
                  subfield.required ||
                  subfield.is_required
              )
            }))
          : []
      };
    })
    .filter(Boolean);
}

export function generateCallObjective(formName, fields) {
  const required = fields.filter((field) => field.required);
  const optional = fields.filter((field) => !field.required);

  const requiredText = required.map((field) => field.label).join(", ");
  const optionalText = optional.slice(0, 6).map((field) => field.label).join(", ");

  let objective = `Conduct a natural voice conversation to complete the ${formName} form.`;

  if (requiredText) {
    objective += ` Collect all required information: ${requiredText}.`;
  }

  if (optionalText) {
    objective += ` Also collect relevant optional information where appropriate: ${optionalText}.`;
  }

  objective +=
    " Ask follow-up questions when an answer is unclear. Return structured values using the Creator field link names.";

  return objective;
}
