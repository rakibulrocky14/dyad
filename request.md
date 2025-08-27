### Request for MCP Server Integration:

I want to add **MCP server support** to this app. If you aren’t familiar with **MCP servers**, you can research them online to understand how they work. Here's a breakdown of what needs to be done:

### Tasks:

1. **Add MCP Server Configuration Section:**

   - Create a new section in the app’s **Settings** where users can configure MCP servers.
   - Users should be able to add MCP servers using **JSON configuration** files, similar to how tools like **Cursor** or **Windsurf** add MCP support in their AI settings.

2. **MCP JSON Configuration:**

   - The user should be able to paste a JSON code snippet to add an MCP server.
   - The JSON should allow users to specify:

     - The **transport method** (whether it's `stdio` or `http`).
     - The **command** to run the MCP server (for `stdio`) or **URL** (for `http`).
     - Any **arguments** or **environment variables** needed to configure the server.

   **Example JSON (stdio)**:

   ```json
   {
     "mcpServers": [
       {
         "id": "weather-mcp",
         "name": "Local Weather MCP",
         "transport": "stdio",
         "command": "python weather_mcp.py",
         "args": ["--port", "9000"],
         "env": {
           "API_KEY": "your_weather_api_key_here"
         }
       }
     ]
   }
   ```

   **Example JSON (http)**:

   ```json
   {
     "mcpServers": [
       {
         "id": "weather-mcp",
         "name": "Weather API MCP",
         "transport": "http",
         "url": "http://localhost:9000/weather",
         "headers": {
           "Authorization": "Bearer your_weather_api_key_here"
         }
       }
     ]
   }
   ```

3. **Dynamic AI System Prompt Update:**

   - Whenever a new MCP server is added, the **AI system prompt** should be dynamically updated to reflect the availability of that MCP server.
   - If an MCP server is added, the system prompt should automatically include the tool names and descriptions (e.g., "Available MCP tools: weather-mcp for weather forecast").

4. **MCP Tool Call Handling:**

   - When the AI calls any MCP tool, it should be displayed in the chat window (just like regular text responses when called writting tags or other tags).
   - The response should align with the existing **Dyad tags**—do not remove them, as they are integral to how the app displays information.
   - But you need to add function calling only when MCP server is called because MCP cannot work without function calling as if we use dyad tags here the the AI will finish respose before getting the MCP server response so we need to use function calling for working properly but other like writting ot other stuff will work like before using dyad tags so that's hybrid aproch actually.

5. **Implementation and Debugging:**

   - After implementing the MCP server integration, **run the app** to test the functionality.
   - If any errors are encountered, identify and **fix them**.

---

### Next Steps:

1. **Research MCP Servers:**

   - Review the **Model Context Protocol (MCP)** documentation to understand the transport methods (`stdio` vs `http`), server configuration, and how MCP tools are invoked.
   - Explore the **JSON format** used for MCP configuration, including both local (`stdio`) and web-based (`http`) integrations.

2. **Understand the Codebase:**

   - Investigate your app’s codebase to identify where and how to integrate MCP support, focusing on sections related to settings and the system prompt.
   - Check for any existing implementation of similar external tool integrations.

3. **Implement the Changes:**

   - Add the new settings section where users can configure MCP servers.
   - Ensure that the AI system prompt is dynamically updated when new MCP servers are added.
   - Implement the handling of MCP tool calls in the chat window.
   - Implement to show the call of MCP in chat, like how AI writing works in this application.

---

### Summary of MCP:

The **Model Context Protocol (MCP)** is a standardized way to enable AI systems to interact with external tools (e.g., APIs, local servers) through a consistent protocol. It supports **two transport methods**:

- **`stdio`**: Communication through standard input/output (ideal for local, script-based tools).
- **`http`**: Communication over HTTP (ideal for remote or web-based tools).

Using the **JSON configuration**, users can specify the **server type**, **transport method**, and any necessary configuration (such as API keys or arguments).
