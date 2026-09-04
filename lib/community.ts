export type CampfirePostRow = {
  id: number;
  body: string;
  created_at: string;
  user_id: string;
  parent_post_id: number | null;
};

export type CampfireVoteRow = { post_id: number; user_id: string; vote: number };
export type CommunityProfile = { id: string; display_name: string; team_name: string; avatar_key: string };

export type CampfireItem = {
  id: number;
  body: string;
  createdAt: string;
  name: string;
  teamName: string;
  avatarKey: string;
};

export type CampfireThread = CampfireItem & {
  upvotes: number;
  downvotes: number;
  score: number;
  myVote: -1 | 0 | 1;
  replies: CampfireItem[];
};

function item(post: CampfirePostRow, profiles: Map<string, CommunityProfile>): CampfireItem {
  const profile = profiles.get(post.user_id);
  return {
    id: post.id,
    body: post.body,
    createdAt: post.created_at,
    name: profile?.display_name || "Player",
    teamName: profile?.team_name || "",
    avatarKey: profile?.avatar_key || "torch",
  };
}

export function buildCampfireThreads(
  posts: CampfirePostRow[],
  votes: CampfireVoteRow[],
  profiles: CommunityProfile[],
  currentUserId: string,
): CampfireThread[] {
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const replies = new Map<number, CampfireItem[]>();

  for (const post of posts) {
    if (post.parent_post_id === null) continue;
    const group = replies.get(post.parent_post_id) || [];
    group.push(item(post, profileMap));
    replies.set(post.parent_post_id, group);
  }
  for (const group of replies.values()) {
    group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  return posts
    .filter((post) => post.parent_post_id === null)
    .map((post) => {
      const postVotes = votes.filter((vote) => vote.post_id === post.id);
      const upvotes = postVotes.filter((vote) => vote.vote === 1).length;
      const downvotes = postVotes.filter((vote) => vote.vote === -1).length;
      const myVote = postVotes.find((vote) => vote.user_id === currentUserId)?.vote;
      const normalizedVote: -1 | 0 | 1 = myVote === 1 ? 1 : myVote === -1 ? -1 : 0;
      return {
        ...item(post, profileMap),
        upvotes,
        downvotes,
        score: upvotes - downvotes,
        myVote: normalizedVote,
        replies: replies.get(post.id) || [],
      };
    })
    .sort((a, b) => b.score - a.score || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
