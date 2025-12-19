# IDENTIFYING RECORDS BY ID:

- Records have wsId and id fields.
- The wsId is the unique identifier for the record managed by Scratch.
- The id is the unique identifier for the record managed by the external service.
- When a new record is created in scratch it temporarely receives an id in the format of "unpublished\_<wsId>".
- When a new record is published to the remote service, the wsId remains the same but the id is updated to the remote service's id.
