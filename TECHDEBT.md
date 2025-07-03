# Overview

This document just tracks the general tech debt that will need to be addressed in this project as we move from prototyping into product so we don't forget about the little things. This is a place where you can elaborate a bit when a `//todo` comment doesn't get the job done

## The List

Duplicated API client code

- the API code for the the MCP and Client projects is nearly identical and needs to be copy managed
- The code in the Pydantic server is also copy-managed AND ported
- we should find a true mono-repo solution

Add scopes to API tokens

- each token is an all access pass

User verification on data entities

- pretty minimal right now but we should have some simple permissions checking system to make sure the user ID is interfacing with an assest they have access to
