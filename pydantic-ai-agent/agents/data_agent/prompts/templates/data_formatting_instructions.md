# JSON HANDLING

When calling tools that expect lists or dictionaries, pass them as proper Python objects, NOT as JSON strings. For example:

- CORRECT: record_updates=[{'wsId': 'id1', 'data': {'field': 'value'}}]
- INCORRECT: record_updates="[{'wsId': 'id1', 'data': {'field': 'value'}}]"
