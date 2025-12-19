from logging import getLogger
from pathlib import Path

from server.capabilities import (
    DATA_CREATE,
    DATA_DELETE,
    DATA_FETCH_TOOLS,
    DATA_FIELD_TOOLS,
    DATA_UPDATE,
    OTHER_URL_CONTENT_LOAD,
    TABLE_ADD_COLUMN,
    TABLE_REMOVE_COLUMN,
    VIEWS_FILTERING,
    has_capability,
    has_data_manipulation_capabilities,
    has_one_of_capabilities,
)

logger = getLogger(__name__)


"""
Constructs the system prompt for the agent based on a set of capabilities, prompt assets, and data scope.

The prompt is assembled from a set of templates, each of which is a markdown file in the templates directory.
"""


class SystemPromptBuilder:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SystemPromptBuilder, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        # Prevent reloading templates if already initialized (singleton pattern)
        if hasattr(self, "_templates_loaded"):
            return

        # Load template files from the templates directory into a dictionary
        templates_dir = Path(__file__).parent / "templates"
        self._templates: dict[str, str] = {}

        # Load all .md files from the templates directory
        for template_file in templates_dir.glob("*.md"):
            template_key = template_file.stem  # filename without extension
            try:
                with open(template_file, "r", encoding="utf-8") as f:
                    self._templates[template_key] = f.read()
            except Exception as e:
                logger.error(f"Error loading template {template_file}: {e}")
                raise

        # Mark templates as loaded
        self._templates_loaded = True

    def getPrompt(self, filename: str) -> str:
        """Get a prompt template by filename (without extension)."""
        if filename not in self._templates:
            raise KeyError(
                f"Template '{filename}' not found. Available templates: {list(self._templates.keys())}"
            )
        return self._templates[filename]

    def _construct_filtering_instructions(
        self, capabilities: list[str] | None = None
    ) -> str:
        if has_capability(VIEWS_FILTERING, capabilities):
            return self.getPrompt("views_filtering_and_focus_instructions")
        return ""

    def _construct_data_manipulation_instructions_for_table_scope(
        self,
        capabilities: list[str] | None = None,
    ) -> str:
        if not has_data_manipulation_capabilities(capabilities):
            return ""

        instructions = "# DATA MANIPULATION:\n"
        if has_capability(DATA_CREATE, capabilities):
            instructions += (
                "- Use create_records_tool to add new records with data you generate\n"
            )
        if has_capability(DATA_UPDATE, capabilities):
            instructions += "- Use update_records_tool to modify existing records (creates suggestions, not direct changes)\n"
        if has_capability(DATA_DELETE, capabilities):
            instructions += (
                "- Use delete_records_tool to suggest removal of records by their IDs\n"
            )

        if has_capability(DATA_FIELD_TOOLS, capabilities):
            instructions += """- Use set_field_value_tool to set a value in a specific field in a record.
- Use append_field_value_tool to append a value to a specific field in a record.
- Use insert_value_tool to insert a value into a specific field in a record.
- Use search_and_replace_field_value_tool to search and replace a value in a specific field in a record.
"""

        if has_capability(DATA_CREATE, capabilities):
            instructions += """
## For creating records, you should:
1. Generate appropriate data for each column based on the schema
2. Call create_records_tool with the generated data
"""

        if has_capability(DATA_UPDATE, capabilities):
            instructions += """
## For updating records, you should do the following actions:
1. Identify the record IDs (wsId) that should be updated
2. Generate the new data for each record
3. Call the `update_records` tool with the parameters in it's schema/description
4. After the tool succeeds or fails call the `final_result` tool present the result to the user.
"""

        if has_capability(DATA_DELETE, capabilities):
            instructions += """
## For deleting records, you should:
1. Identify the record IDs (wsId) that should be deleted
2. Call delete_records_tool with the list of record IDs to delete
"""

        instructions += """
## IMPORTANT:
- do not call tools that are not available to you.
- do not call more than 1 tool at a time
- do not call the same tool multiple times at a time
- if the tool succeeds do not call it again for the same user prompt
- if a tool call succeeds you should not try to verify the result; believe that it did; just call the final_result tool
- if the tool fails retry it up to 2 more times for the same user prompt after fixing the error
"""

        return instructions

    def _construct_data_manipulation_instructions_for_record_scope(
        self,
        capabilities: list[str] | None = None,
    ) -> str:
        return self.getPrompt("data_manipulation_instructions_record_scoped")

    def _construct_data_manipulation_instructions_for_column_scope(
        self,
        capabilities: list[str] | None = None,
    ) -> str:
        return self.getPrompt("data_manipulation_instructions_column_scoped")

    def _construct_supporting_tools_instructions(
        self,
        capabilities: list[str] | None = None,
    ) -> str:
        if has_capability(OTHER_URL_CONTENT_LOAD, capabilities):
            return self.getPrompt("supporting_tools_instructions")
        return ""

    def _construct_table_tools_instructions(
        self, capabilities: list[str] | None = None
    ) -> str:
        if not has_one_of_capabilities(
            capabilities, TABLE_ADD_COLUMN, TABLE_REMOVE_COLUMN
        ):
            return ""

        instructions = self.getPrompt("table_tools_instructions_base")

        if has_capability(TABLE_ADD_COLUMN, capabilities):
            instructions += (
                "- add_column_tool - adds a new scratch column to the active table\n"
            )
        if has_capability(TABLE_REMOVE_COLUMN, capabilities):
            instructions += "- remove_column_tool - removes a scratch column from the active table\n"
        return instructions

    def _construct_data_fetch_tools_instructions(
        self,
        capabilities: list[str] | None = None,
    ) -> str:
        if has_capability(DATA_FETCH_TOOLS, capabilities):
            return self.getPrompt("data_fetch_tools_instructions")
        return ""

    def _construct_base_instructions(self, data_scope: str | None = None) -> str:
        if data_scope == "record":
            return self.getPrompt("base_instructions_record_scoped")
        elif data_scope == "column":
            return self.getPrompt("base_instructions_column_scoped")
        return self.getPrompt("base_instructions_table_scoped")

    def _construct_data_manipulation_instructions(
        self, data_scope: str | None = None, capabilities: list[str] | None = None
    ) -> str:
        if data_scope == "record":
            return self._construct_data_manipulation_instructions_for_record_scope(
                capabilities
            )
        elif data_scope == "column":
            return self._construct_data_manipulation_instructions_for_column_scope(
                capabilities
            )
        return self._construct_data_manipulation_instructions_for_table_scope(
            capabilities
        )

    def _construct_prompt_assets(
        self, prompt_assets: dict[str, str] | None = None
    ) -> str:

        if prompt_assets:
            prompt_assets_section = "\n\n# ASSETS\n"
            for key, content in prompt_assets.items():
                prompt_assets_section += f"\n## {key}\n\n{content}\n"
            return prompt_assets_section
        return ""

    def build(
        self,
        capabilities: list[str] | None = None,
        prompt_assets: dict[str, str] | None = None,
        data_scope: str | None = None,
    ) -> str:

        prompt_parts = [
            self._construct_base_instructions(data_scope),
            self.getPrompt("identifying_records"),
            self._construct_data_manipulation_instructions(data_scope, capabilities),
            self.getPrompt("final_response_instructions"),
            self.getPrompt("data_formatting_instructions"),
            self.getPrompt("data_structure_instructions"),
            self.getPrompt("mention_system_instructions"),
            self._construct_filtering_instructions(capabilities),
            self._construct_data_fetch_tools_instructions(capabilities),
            self._construct_supporting_tools_instructions(capabilities),
            self._construct_table_tools_instructions(capabilities),
            self._construct_prompt_assets(prompt_assets),
        ]

        return "\n".join(prompt_parts)
