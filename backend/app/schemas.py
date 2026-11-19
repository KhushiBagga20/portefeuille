"""Public shapes mirror the existing src/lib/types.ts; private todo fields are forbidden."""

import hashlib
import json
from datetime import date
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator


def safe_url(value: str) -> str:
    if any(ord(c) < 32 for c in value) or "\\" in value:
        raise ValueError("Invalid URL")
    if value.startswith("/") and not value.startswith("//"):
        return value
    parsed = urlsplit(value)
    if parsed.scheme not in ("https", "http") or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Use a relative /path or HTTP(S) URL")
    return value


URL = Annotated[str, AfterValidator(safe_url)]
Stage = Literal["done", "ongoing", "planned"]
Slug = Annotated[str, Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=100)]


class Shape(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True, allow_inf_nan=False)


class Media(Shape):
    kind: Literal["image", "video"]
    src: URL
    alt: str
    caption: str | None = None
    width: int | None = Field(default=None, gt=0)
    height: int | None = Field(default=None, gt=0)


class Disk(Shape):
    tone: Literal["tomato", "pink", "lilac", "lemon", "sky", "mint"]
    scribble: str


class Links(Shape):
    github: URL | None = None
    demo: URL | None = None


class ProjectContent(Shape):
    slug: Slug
    status: Literal["draft", "published"] = "published"
    name: str = Field(min_length=1, max_length=200)
    earlierName: str | None = None
    type: str
    oneLiner: str | None = None
    preview: str | None = None
    labels: list[
        Literal[
            "Hackathon",
            "Recognition",
            "Ongoing",
            "AI",
            "Social impact",
            "Product design",
            "Native software",
            "Personal project",
            "Workshop",
        ]
    ]
    event: str | None = None
    outcome: list[str] | None = None
    role: str | None = None
    stack: list[str] | None = None
    disk: Disk
    links: Links


class Intro(Shape):
    problem: list[str] | None = None
    built: list[str] | None = None
    highlights: list[str] | None = None
    media: list[Media] | None = None


class Feature(Shape):
    title: str
    stage: Stage | None = None
    note: str | None = None
    items: list[str]


class Node(Shape):
    id: str
    label: str
    kind: Literal["device", "app", "service", "link", "channel", "store", "person", "step", "outcome"]
    col: float
    row: float
    rows: float | None = Field(default=None, gt=0)
    summary: str | None = None
    details: list[str] | None = None
    tech: list[str] | None = None
    stage: Stage | None = None


class Edge(Shape):
    from_: str = Field(alias="from")
    to: str
    label: str | None = None
    flow: Literal["forward", "back", "both"]
    stage: Stage | None = None


class Diagram(Shape):
    id: str
    title: str
    caption: str | None = None
    basis: Literal["built", "designed"]
    nodes: list[Node]
    edges: list[Edge]

    @model_validator(mode="after")
    def check_graph(self):
        ids = {n.id for n in self.nodes}
        if len(ids) != len(self.nodes) or any(e.from_ not in ids or e.to not in ids for e in self.edges):
            raise ValueError("Diagram requires unique nodes and valid edge references")
        return self


class MindNode(Shape):
    label: str
    note: str | None = None
    stage: Stage | None = None
    children: list["MindNode"] | None = None


class Milestone(Shape):
    title: str
    stage: Stage
    date: str | None = Field(default=None, pattern=r"^\d{4}(-\d{2}(-\d{2})?)?$")
    kind: Literal["milestone", "achievement", "challenge", "recognition"] | None = None
    body: str | None = None
    items: list[str] | None = None
    media: list[Media] | None = None


class Update(Shape):
    date: date
    title: str = Field(min_length=1, max_length=200)
    body: str | None = Field(default=None, max_length=8000)
    stage: Stage | None = None
    media: list[Media] | None = None


class Code(Shape):
    lang: str
    source: str
    caption: str | None = None


class DeepDive(Shape):
    title: str
    kind: Literal["algorithm", "protocol", "architecture", "tradeoff", "debugging"] | None = None
    summary: str | None = None
    body: list[str] | None = None
    chose: str | None = None
    because: str | None = None
    tradeoff: str | None = None
    code: Code | None = None


class Reflection(Shape):
    worked: list[str] | None = None
    didnt: list[str] | None = None
    learned: list[str] | None = None
    improve: list[str] | None = None


class CaseStudy(Shape):
    slug: Slug
    status: Literal["draft", "published"] = "published"
    updated: date | None = None
    intro: Intro
    features: list[Feature] | None = None
    diagrams: list[Diagram] | None = None
    mindmap: (
        dict[
            Literal["idea", "research", "challenges", "decisions", "implementation", "future"], list[MindNode]
        ]
        | None
    ) = None
    timeline: list[Milestone] | None = None
    updates: list[Update] | None = None
    deepDives: list[DeepDive] | None = None
    reflection: Reflection | None = None


class Content(Shape):
    project: ProjectContent
    caseStudy: CaseStudy

    @model_validator(mode="after")
    def same_slug(self):
        if self.project.slug != self.caseStudy.slug:
            raise ValueError("Project and case study slugs must match")
        return self

    def public(self):
        value = self.model_dump(mode="json", by_alias=True, exclude_none=True)
        value["project"]["status"] = value["caseStudy"]["status"] = "published"
        return value


def digest(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    ).hexdigest()


class RevisionInput(Shape):
    content: Content
    base_version: int = Field(ge=0)
    parent_id: str | None = None


class PublishInput(Shape):
    revision_id: str
    content_hash: str
    expected_version: int = Field(ge=0)
    idempotency_key: str = Field(min_length=16, max_length=100)


class RepositoryInput(Shape):
    github_id: str = Field(pattern=r"^\d+$")
    full_name: str = Field(pattern=r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
    allow_ai: bool = False


class GenerateInput(Shape):
    evidence_ids: list[str] = Field(min_length=1, max_length=20)
    base_version: int = Field(ge=1)


class ImportRepositoriesInput(Shape):
    repository_ids: list[Annotated[str, Field(pattern=r"^\d+$")]] = Field(min_length=1, max_length=20)


class ScanInput(Shape):
    enable_source_analysis: bool = False


class AIProposal(Shape):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=5000)
    evidence_ids: list[str] = Field(min_length=1, max_length=20)
    questions: list[str]
